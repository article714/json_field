from odoo.addons.json_field import fields, models
from odoo import fields as ofields
from odoo import api
import logging


class TestJson(models.JsonModels):
    _name = "test_json"

    json_field = fields.Jsonb()

    format_json_id = ofields.Many2one("test_format_json")

    format_json_schema = fields.Jsonb(compute="_compute_schema")

    @api.onchange("format_json_id")
    @api.depends("format_json_id")
    def _compute_schema(self):
        for rec in self:
            rec.format_json_schema = rec.format_json_id.schema


class TestFormatJson(models.JsonModels):
    _name = "test_format_json"

    schema = fields.Jsonb(schema={})
