"""Consulta receipts de Expo para uno o mas ticket IDs.

Uso:
  python manage.py check_push_receipts TICKET_ID [TICKET_ID...]
  python manage.py check_push_receipts TICKET_ID --user-id 42
"""

from django.core.management.base import BaseCommand, CommandError

from accounts.notifications import process_push_receipts


class Command(BaseCommand):
    help = 'Consulta Expo push receipts (ticket ok != entrega en el dispositivo).'

    def add_arguments(self, parser):
        parser.add_argument(
            'ticket_ids',
            nargs='+',
            help='IDs de ticket Expo (los que aparecen en [PUSH] Ticket ID)',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            default=None,
            help='Si el receipt es DeviceNotRegistered, limpia el token de este user.',
        )

    def handle(self, *args, **options):
        ticket_ids = options['ticket_ids']
        user_id = options['user_id']
        self.stdout.write(f'[PUSH] Consultando {len(ticket_ids)} receipt(s)...')
        try:
            receipts = process_push_receipts(ticket_ids, user_id=user_id)
        except Exception as exc:
            raise CommandError(str(exc)) from exc

        if not receipts:
            self.stdout.write(self.style.WARNING(
                '[PUSH] Sin receipts (aun no listos, IDs invalidos, o error de red). '
                'Reintenta en ~15-60s.',
            ))
            return

        for ticket_id, receipt in receipts.items():
            if not isinstance(receipt, dict):
                self.stdout.write(f'{ticket_id}: {receipt!r}')
                continue
            status = receipt.get('status')
            details = receipt.get('details') if isinstance(receipt.get('details'), dict) else {}
            err = details.get('error')
            line = f'[PUSH] Receipt {ticket_id}: status={status}'
            if err:
                line += f' error={err}'
            style = self.style.SUCCESS if status == 'ok' else self.style.ERROR
            self.stdout.write(style(line))
