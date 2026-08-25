from django import template

register = template.Library()


@register.simple_tag(takes_context=True)
def keep_query(context, **kwargs):
    """Build a query string keeping current GET filters, with optional overrides."""
    request = context.get('request')
    if request is None:
        return ''
    params = request.GET.copy()
    params.pop('page', None)
    for key, value in kwargs.items():
        if value is None or value == '':
            params.pop(key, None)
        else:
            params[key] = str(value)
    encoded = params.urlencode()
    return f'?{encoded}' if encoded else ''
