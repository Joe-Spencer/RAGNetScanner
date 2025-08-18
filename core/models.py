from django.db import models


class Document(models.Model):
    file_path = models.TextField(unique=True)
    file_name = models.CharField(max_length=512)
    file_type = models.CharField(max_length=64)
    contractor = models.CharField(max_length=256, blank=True, default="")
    project = models.CharField(max_length=256, blank=True, default="")
    size_bytes = models.BigIntegerField(default=0)
    modified_at = models.DateTimeField(null=True, blank=True)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.file_name


class DocumentChunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    chunk_index = models.IntegerField()
    text = models.TextField()
    embedding = models.BinaryField()  # store as bytes (e.g., float32 array serialized)

    class Meta:
        unique_together = ("document", "chunk_index")

    def __str__(self) -> str:
        return f"{self.document.file_name} [chunk {self.chunk_index}]"

# Create your models here.
