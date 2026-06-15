from rest_framework import serializers

from .geo import round_coordinate


class CoordinateField(serializers.DecimalField):
    """Redondea coordenadas GPS antes de validar max_digits."""

    def to_internal_value(self, data):
        if data is None or data == '':
            if self.allow_null:
                return None
            self.fail('required')
        rounded = round_coordinate(data)
        return super().to_internal_value(rounded)
