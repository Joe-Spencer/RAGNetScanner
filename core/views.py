import os
import io
import json
import mimetypes
import time
from datetime import datetime
import base64
from typing import List, Tuple
import sys

from django.conf import settings
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.db.models import Q

from rest_framework.decorators import api_view
from rest_framework import status

from .models import Document, DocumentChunk

from openai import OpenAI
from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from array import array
import math
from .vectorstore import rebuild_index_from_db, search_similar_chunks


def _read_text_from_file(path: str) -> str:
    mime, _ = mimetypes.guess_type(path)
    if not mime:
        mime = "application/octet-stream"
    mime = mime.lower()

    try:
        if mime.startswith("text/"):
            try:
                if os.path.getsize(path) > getattr(settings, 'SCAN_MAX_BYTES', 10 * 1024 * 1024):
                    return ""
            except Exception:
                pass
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        if mime == "application/pdf" or path.lower().endswith(".pdf"):
            text = []
            try:
                if os.path.getsize(path) > getattr(settings, 'SCAN_MAX_BYTES', 10 * 1024 * 1024):
                    return ""
            except Exception:
                pass
            reader = PdfReader(path)
            for page in reader.pages:
                text.append(page.extract_text() or "")
            return "\n".join(text)
        # Fallback: don't try to read binary images here; just return empty
        return ""
    except Exception:
        return ""


def _describe_file_with_openai(client: OpenAI, path: str, mode: str = "concise") -> str:
    # Prefer text extraction; if unavailable, try vision on images; else fallback to filename-based description.
    text = _read_text_from_file(path)
    if text:
        if mode == "detailed":
            style = "Write a thorough 3-6 sentence summary for search and discovery. Focus on key topics, entities, purpose, and important details."
        elif mode == "creative":
            style = "Write a catchy 1-3 sentence summary suitable for search and discovery."
        else:
            style = "Summarize the following file content in 1-3 sentences for search and discovery. Focus on key topics, entities, and purpose."
        prompt = style + "\n\n" + text[:6000]
        try:
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that writes concise summaries."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=160,
            )
            return completion.choices[0].message.content.strip()
        except Exception:
            # fall through to attempt vision or filename-based
            pass

    # If no text, try multimodal vision for images
    mime, _ = mimetypes.guess_type(path)
    mime = (mime or "").lower()
    if mime.startswith("image/"):
        try:
            with open(path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            data_url = f"data:{mime};base64,{b64}"
            if mode == "detailed":
                vision_text = "Describe this image in 2-4 sentences for search and discovery. Mention key objects, visible text, and purpose."
            elif mode == "creative":
                vision_text = "Describe this image in 1-2 punchy sentences for search and discovery."
            else:
                vision_text = "Describe this image in 1-3 sentences for search and discovery. Mention key objects, text, and purpose succinctly."
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that writes concise visual descriptions for search."},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": vision_text},
                            {"type": "image_url", "image_url": {"url": data_url}},
                        ],
                    },
                ],
                temperature=0.2,
                max_tokens=120,
            )
            desc = completion.choices[0].message.content.strip()
            if desc:
                return desc
        except Exception:
            pass

    # Fallback: filename-based description
    base_name = os.path.basename(path)
    return f"File named {base_name}.".strip()


def _embed_texts(client: OpenAI, texts: List[str]) -> List[List[float]]:
    if not texts:
        return []
    resp = client.embeddings.create(model="text-embedding-3-small", input=texts)
    vectors = [list(item.embedding) for item in resp.data]
    return vectors


def _bytes_from_vector(vec: List[float]) -> bytes:
    # Store as float32 bytes
    return array('f', vec).tobytes()


def _vector_from_bytes(blob: bytes) -> List[float]:
    arr = array('f')
    arr.frombytes(blob)
    return arr.tolist()


@api_view(["POST"])
@csrf_exempt
def scan_directory(request: HttpRequest):
    try:
        body = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    directory = body.get("directory")
    contractor = body.get("contractor", "")
    project = body.get("project", "")
    mode = str(body.get("mode", "concise") or "concise").lower()
    cutoff = body.get("cutoff")  # ISO string
    cutoff_dt = None
    if cutoff:
        try:
            cutoff_dt = datetime.fromisoformat(cutoff)
        except Exception:
            cutoff_dt = None

    if not directory or not os.path.isdir(directory):
        return JsonResponse({"error": "Invalid directory"}, status=400)

    if not settings.OPENAI_API_KEY:
        return JsonResponse({"error": "Server missing OPENAI_API_KEY. Set it in .env and restart."}, status=500)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    processed = 0
    created = 0
    updated = 0
    new_chunks = 0
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

    ignore_dirs = set(getattr(settings, 'SCAN_IGNORE_DIRS', set()))
    with transaction.atomic():
        for root, dirs, files in os.walk(directory):
            # Prune ignored directories in-place for efficiency
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for fname in files:
                path = os.path.join(root, fname)

                try:
                    stat = os.stat(path)
                except Exception:
                    continue

                modified_at = datetime.fromtimestamp(stat.st_mtime)
                if cutoff_dt and modified_at < cutoff_dt:
                    continue

                mime, _ = mimetypes.guess_type(path)
                file_type = mime or "application/octet-stream"

                description = _describe_file_with_openai(client, path, mode=mode)
                doc, created_flag = Document.objects.update_or_create(
                    file_path=path,
                    defaults=dict(
                        file_name=fname,
                        file_type=file_type,
                        contractor=contractor,
                        project=project,
                        size_bytes=stat.st_size,
                        modified_at=modified_at,
                        description=description,
                    ),
                )
                processed += 1
                created += int(created_flag)
                updated += int(not created_flag)

                # Chunk text and embed
                text = _read_text_from_file(path)
                if text:
                    chunks = text_splitter.split_text(text)
                    max_chunks = int(getattr(settings, 'SCAN_MAX_CHUNKS', 64) or 64)
                    if len(chunks) > max_chunks:
                        chunks = chunks[:max_chunks]
                    if chunks:
                        try:
                            embeddings = _embed_texts(client, chunks)
                        except Exception:
                            embeddings = [[] for _ in chunks]
                        DocumentChunk.objects.filter(document=doc).delete()
                        for idx, (chunk, vec) in enumerate(zip(chunks, embeddings)):
                            try:
                                emb_bytes = _bytes_from_vector(vec) if vec else b""
                            except Exception:
                                emb_bytes = b""
                            DocumentChunk.objects.create(
                                document=doc,
                                chunk_index=idx,
                                text=chunk,
                                embedding=emb_bytes,
                            )
                            new_chunks += 1

    # Rebuild FAISS index after scan (best-effort)
    try:
        rebuild_index_from_db()
    except Exception:
        pass

    return JsonResponse(
        {
            "processed": processed,
            "created": created,
            "updated": updated,
            "chunks_added": new_chunks,
        }
    )


@api_view(["GET"])
def list_documents(request: HttpRequest):
    q = (request.GET.get("q", "") or "").strip()
    try:
        limit = int(request.GET.get("limit", 500))
    except Exception:
        limit = 500
    qs = Document.objects.all()
    if q:
        qs = qs.filter(
            Q(file_name__icontains=q)
            | Q(description__icontains=q)
            | Q(project__icontains=q)
            | Q(contractor__icontains=q)
        )
    qs = qs.order_by("-updated_at")[:limit]
    data = [
        {
            "id": d.id,
            "file_name": d.file_name,
            "file_path": d.file_path,
            "file_type": d.file_type,
            "project": d.project,
            "contractor": d.contractor,
            "size_bytes": d.size_bytes,
            "modified_at": d.modified_at.isoformat() if d.modified_at else None,
            "description": d.description,
        }
        for d in qs
    ]
    return JsonResponse({"results": data})


def _search_similar_chunks(query: str, k: int = 5) -> List[Tuple[DocumentChunk, float]]:
    # Simple in-DB search by cosine against all embeddings (works for small demo DB). For large scale, use FAISS index persisted to disk.
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    q_vec = _embed_texts(client, [query])[0]

    def cosine(a: List[float], b: List[float]) -> float:
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(y * y for y in b))
        denom = (na * nb) or 1.0
        return float(dot / denom)

    results: List[Tuple[DocumentChunk, float]] = []
    for chunk in DocumentChunk.objects.select_related("document").all():
        vec = _vector_from_bytes(chunk.embedding)
        score = cosine(vec, q_vec)
        results.append((chunk, score))
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:k]


@api_view(["POST"])
@csrf_exempt
def ask_question(request: HttpRequest):
    try:
        body = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    question = body.get("question", "")
    if not question:
        return JsonResponse({"error": "Missing question"}, status=400)

    if not settings.OPENAI_API_KEY:
        return JsonResponse({"error": "Server missing OPENAI_API_KEY. Set it in .env and restart."}, status=500)

    top_k = int(body.get("k", 5))
    project_filter = str(body.get("project", "") or "").strip().lower()
    contractor_filter = str(body.get("contractor", "") or "").strip().lower()
    # Use FAISS index if available, else fallback to brute-force
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    q_vec = _embed_texts(client, [question])[0]
    retrieved = search_similar_chunks(q_vec, k=top_k)
    if retrieved is None:
        retrieved = _search_similar_chunks(question, k=top_k)

    def _matches_filters(chunk: DocumentChunk) -> bool:
        if project_filter and project_filter not in (chunk.document.project or "").lower():
            return False
        if contractor_filter and contractor_filter not in (chunk.document.contractor or "").lower():
            return False
        return True

    if retrieved:
        retrieved = [(c, s) for (c, s) in retrieved if _matches_filters(c)] or retrieved

    # Build context; if weak/empty, fall back to database summary so generic queries get a helpful answer
    context_snippets: List[str] = []
    for chunk, score in retrieved:
        context_snippets.append(f"[Score {score:.2f}] From {chunk.document.file_name}:\n{chunk.text}")
    context_text = "\n\n".join(context_snippets)

    has_strong_context = bool(retrieved)
    if has_strong_context:
        try:
            top_score = max(score for _, score in retrieved)
            has_strong_context = top_score >= 0.15
        except Exception:
            has_strong_context = True

    if not has_strong_context:
        # Fallback summary of the database
        total_docs = Document.objects.count()
        projects = list({(d.project or '').strip() for d in Document.objects.exclude(project='')})
        contractors = list({(d.contractor or '').strip() for d in Document.objects.exclude(contractor='')})
        recent = list(Document.objects.order_by('-updated_at')[:5])
        summary_lines = [
            f"Documents: {total_docs}",
            f"Projects: {', '.join(p for p in projects if p) or 'n/a'}",
            f"Contractors: {', '.join(c for c in contractors if c) or 'n/a'}",
            "Recent files:"
        ]
        for d in recent:
            summary_lines.append(f"- {d.file_name}: {d.description[:200] if d.description else ''}")
        context_text = "\n".join(summary_lines)

    prompt = (
        "You are a RAG assistant over a local document database. "
        "Use the provided context to answer the user's question. If the question is generic (e.g., 'what is this'), "
        "briefly explain what the database contains (types of files, projects, contractors) and how to query it. "
        "Prefer concise, grounded answers and cite filenames when relevant.\n\n"
        f"Context:\n{context_text}\n\nQuestion: {question}\nAnswer:"
    )
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You answer with grounded, concise responses."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=400,
    )
    answer = completion.choices[0].message.content.strip()

    return JsonResponse({
        "answer": answer,
        "contexts": [
            {
                "document_id": chunk.document.id,
                "file_name": chunk.document.file_name,
                "score": float(score),
                "preview": chunk.text[:300],
            }
            for chunk, score in retrieved
        ],
    })

# Database management APIs

@api_view(["GET"])
def export_database(request: HttpRequest):
    # Export all Documents with chunk texts (no embeddings) for portability
    payload = []
    for d in Document.objects.all().order_by("-updated_at"):
        item = {
            "file_path": d.file_path,
            "file_name": d.file_name,
            "file_type": d.file_type,
            "contractor": d.contractor,
            "project": d.project,
            "size_bytes": d.size_bytes,
            "modified_at": d.modified_at.isoformat() if d.modified_at else None,
            "description": d.description,
            "chunks": [
                {"index": ch.chunk_index, "text": ch.text}
                for ch in d.chunks.all().order_by("chunk_index")
            ],
        }
        payload.append(item)
    return JsonResponse({"data": payload})


@api_view(["POST"])
@csrf_exempt
def import_database(request: HttpRequest):
    try:
        body = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)

    items = body.get("data", [])
    if not isinstance(items, list):
        return JsonResponse({"error": "data must be a list"}, status=400)

    created = 0
    updated = 0
    chunks_written = 0
    chunks_embedded = 0

    client: OpenAI | None = None
    if settings.OPENAI_API_KEY:
        try:
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
        except Exception:
            client = None

    with transaction.atomic():
        for it in items:
            fp = it.get("file_path")
            if not fp:
                continue
            doc, was_created = Document.objects.update_or_create(
                file_path=fp,
                defaults=dict(
                    file_name=it.get("file_name", ""),
                    file_type=it.get("file_type", "application/octet-stream"),
                    contractor=it.get("contractor", ""),
                    project=it.get("project", ""),
                    size_bytes=int(it.get("size_bytes", 0) or 0),
                    modified_at=datetime.fromisoformat(it["modified_at"]) if it.get("modified_at") else None,
                    description=it.get("description", ""),
                ),
            )
            created += int(was_created)
            updated += int(not was_created)

            # Replace chunks with fresh ones; embed if possible
            DocumentChunk.objects.filter(document=doc).delete()
            chunks = it.get("chunks", []) or []
            texts = [str(ch.get("text", "")) for ch in chunks]
            embeddings: list[list[float]] | None = None
            if client and texts and any(t.strip() for t in texts):
                try:
                    embeddings = _embed_texts(client, texts)
                except Exception:
                    embeddings = None
            for idx, ch in enumerate(chunks):
                vec_bytes = b""
                if embeddings and idx < len(embeddings):
                    vec_bytes = _bytes_from_vector(embeddings[idx])
                    chunks_embedded += 1
                DocumentChunk.objects.create(
                    document=doc,
                    chunk_index=int(ch.get("index", idx) or idx),
                    text=str(ch.get("text", "")),
                    embedding=vec_bytes,
                )
                chunks_written += 1

    # Rebuild FAISS index best-effort
    try:
        rebuild_index_from_db()
    except Exception:
        pass

    return JsonResponse({
        "created": created,
        "updated": updated,
        "chunks_written": chunks_written,
        "chunks_embedded": chunks_embedded,
    })


@api_view(["POST"])
@csrf_exempt
def clear_database(request: HttpRequest):
    DocumentChunk.objects.all().delete()
    Document.objects.all().delete()
    try:
        rebuild_index_from_db()
    except Exception:
        pass
    return JsonResponse({"status": "cleared"})

# Open a file on the host OS (best-effort, local dev convenience)
@api_view(["POST"])
@csrf_exempt
def open_file(request: HttpRequest):
    try:
        body = json.loads(request.body or b"{}")
    except Exception:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    file_path = body.get("file_path", "")
    if not file_path or not os.path.exists(file_path):
        return JsonResponse({"error": "File not found"}, status=400)
    try:
        if os.name == 'nt':  # Windows
            os.startfile(file_path)  # type: ignore[attr-defined]
        elif sys.platform == 'darwin':  # macOS
            import subprocess
            subprocess.Popen(['open', file_path])
        else:  # Linux
            import subprocess
            subprocess.Popen(['xdg-open', file_path])
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    return JsonResponse({"status": "opened"})

# Create your views here.
