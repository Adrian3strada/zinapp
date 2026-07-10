"""Helpers for consistent panel page metadata (title, nav, breadcrumbs)."""


def page_context(title, nav, *, subtitle='', breadcrumbs=None):
    return {
        'page_title': title,
        'nav': nav,
        'page_subtitle': subtitle,
        'breadcrumbs': breadcrumbs or [],
    }
