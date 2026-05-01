import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shabiki.settings")
app = Celery("shabiki")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()