import json
from odoo import fields


class Jsonb(fields.Field):
    type = "json"
    column_type = ("jsonb", "jsonb")

    def convert_to_column(self, value, record, values=None, validate=True):
        return json.dumps(value) if value else None

