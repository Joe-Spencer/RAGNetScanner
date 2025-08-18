from django.contrib import admin
from .models import Document, DocumentChunk


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("file_name", "file_type", "project", "contractor", "modified_at")
    search_fields = ("file_name", "file_path", "project", "contractor", "description")


@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "chunk_index")
    search_fields = ("document__file_name", "text")

# Register your models here.
