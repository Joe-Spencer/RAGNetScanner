from django.urls import path
from . import views

urlpatterns = [
    path('scan/', views.scan_directory, name='scan-directory'),
    path('documents/', views.list_documents, name='list-documents'),
    path('ask/', views.ask_question, name='ask-question'),
    path('export/', views.export_database, name='export-database'),
    path('import/', views.import_database, name='import-database'),
    path('clear/', views.clear_database, name='clear-database'),
    path('open/', views.open_file, name='open-file'),
]


