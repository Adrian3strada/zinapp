from django.contrib.auth import get_user_model
from django.db.models.signals import pre_save
from django.dispatch import receiver

from .username import normalize_username

User = get_user_model()


@receiver(pre_save, sender=User)
def normalize_username_on_save(sender, instance, **kwargs):
    if instance.username:
        instance.username = normalize_username(instance.username)
