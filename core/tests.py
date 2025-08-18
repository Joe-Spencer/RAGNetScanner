from django.test import TestCase, Client
from django.urls import reverse
from django.conf import settings
import os
import tempfile
from .models import Document, DocumentChunk


class APISmokeTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_list_documents_empty(self):
        resp = self.client.get(reverse('list-documents'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('results', resp.json())

    def test_scan_directory_invalid(self):
        resp = self.client.post(reverse('scan-directory'), data='{}', content_type='application/json')
        self.assertEqual(resp.status_code, 400)


# Create your tests here.
