import os
import json
from pathlib import Path
from typing import List, Tuple, Optional

from django.conf import settings

try:
    import numpy as np  # type: ignore
except Exception:  # pragma: no cover
    np = None  # numpy is optional on some Windows setups

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None  # allows import without faiss installed

from .models import DocumentChunk


def _index_dir() -> Path:
    path = Path(settings.BASE_DIR) / 'data' / 'faiss'
    path.mkdir(parents=True, exist_ok=True)
    return path


def _index_paths() -> Tuple[Path, Path]:
    d = _index_dir()
    return d / 'index.bin', d / 'mapping.json'


def _normalize_matrix(vectors):
    if np is None:
        return vectors
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0.0] = 1.0
    return vectors / norms


def rebuild_index_from_db() -> bool:
    # Requires both faiss and numpy
    if faiss is None or np is None:
        return False
    chunks = list(DocumentChunk.objects.all().only('id', 'embedding'))
    if not chunks:
        return False
    embeddings = []
    ids = []
    target_dim = None
    for ch in chunks:
        vec = np.frombuffer(ch.embedding, dtype=np.float32)
        if vec.size == 0:
            continue
        if target_dim is None:
            target_dim = int(vec.size)
        if int(vec.size) != target_dim:
            continue
        embeddings.append(vec)
        ids.append(ch.id)
    if not embeddings:
        return False
    matrix = np.stack(embeddings, axis=0)
    d = matrix.shape[1]
    matrix = _normalize_matrix(matrix.astype(np.float32))
    index = faiss.IndexFlatIP(d)
    index.add(matrix)

    index_path, mapping_path = _index_paths()
    faiss.write_index(index, str(index_path))
    with open(mapping_path, 'w', encoding='utf-8') as f:
        json.dump(ids, f)
    return True


def _load_index() -> Optional[Tuple["faiss.Index", List[int]]]:  # type: ignore
    if faiss is None:
        return None
    index_path, mapping_path = _index_paths()
    if not index_path.exists() or not mapping_path.exists():
        return None
    index = faiss.read_index(str(index_path))
    with open(mapping_path, 'r', encoding='utf-8') as f:
        ids: List[int] = json.load(f)
    return index, ids


def search_similar_chunks(query_vector, k: int = 5) -> Optional[List[Tuple[DocumentChunk, float]]]:
    # Requires both faiss and numpy; otherwise, caller should fall back
    if faiss is None or np is None:
        return None
    loaded = _load_index()
    if loaded is None:
        return None
    index, ids = loaded
    q = np.asarray(query_vector, dtype=np.float32)
    q = q / (np.linalg.norm(q) or 1.0)
    distances, indices = index.search(q.reshape(1, -1), k)
    idxs = indices[0]
    dists = distances[0]
    # Map FAISS row indices to DB primary keys
    pk_list: List[int] = []
    scores: List[float] = []
    for i, dist in zip(idxs, dists):
        if i < 0:
            continue
        pk_list.append(ids[i])
        scores.append(float(dist))
    if not pk_list:
        return []
    chunks = list(DocumentChunk.objects.select_related('document').filter(id__in=pk_list))
    order = {pk: pos for pos, pk in enumerate(pk_list)}
    chunks.sort(key=lambda c: order.get(c.id, 1_000_000))
    return list(zip(chunks, scores))



