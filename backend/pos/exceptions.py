"""Excepciones de dominio del POS."""


class PosError(Exception):
    """Error de negocio POS (mensaje seguro para UI)."""

    def __init__(self, message: str, *, code: str = 'pos_error'):
        self.message = message
        self.code = code
        super().__init__(message)
