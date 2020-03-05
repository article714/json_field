odoo.define('json_field_widget', function (require) {
    "use strict";
    var AbstractField = require('web.AbstractField');
    var fieldRegistry = require('web.field_registry');
    var core = require('web.core');

    var objectGetPath = function (obj, path) {
        if (path == []) {
            return obj;
        }
        for (var i = 0, len = path.length; i < len; i++) {
            obj = obj[path[i]];
            if (obj == undefined) {

                return obj;
            }
        };
        return obj;
    };

    var string_to_path = function (string) {
        return string.split('.')
    };

    var path_to_string = function (path) {
        return path.join('.')
    };

    var jsonField = AbstractField.extend({
        className: 'o_json_list',
        tagName: 'div',
        supportedFieldTypes: ['jsonb'],
        events: _.extend({}, AbstractField.prototype.events, {
            'change .json_value': '_valueChanged',
            'change .json_key': '_keyChanged',
            'click .json_add_row': '_addNewRow',
            'click .json_edit_key': '_editKey',
            'click .json_delete_key': '_deleteKey',
            'focusout .input_json_edit_key': '_unEditKey'
        }),


        init: function () {
            this._super.apply(this, arguments);
            window.a = arguments;

            this.resetOnAnyFieldChange = true;
            this.savedValue = '';
        },

        _updateSchema: function () {
            if (this.attrs.json_schema) {
                this.schema = this.recordData[this.attrs.json_schema];
            } else {
                this.schema = false;
            }
        },

        _renderEdit: function () {
            this._updateSchema();
            this._renderTable(true);
        },

        _renderReadonly: function () {
            this._updateSchema();
            this._renderTable(false);
        },

        _renderTable: function (edit) {
            this.$el.empty();

            const $table = $('<table>',
                { 'class': ' o_list_view table table-sm table-hover table-striped json_table' });
            this.$el.append($table);

            // Add Header
            const $thead = $('<thead>');
            $table.append($thead);
            const $tr_head = $('<tr>');
            $thead.append($tr_head);
            const $th_key = $('<th>', { class: 'o_column', text: 'Key' });
            $tr_head.append(
                $th_key,
                $('<th>', { class: 'o_column', text: 'Value' }));

            if (edit & this.schema == false) {
                const $add_row_btn = $('<i>', { text: '', class: 'fa fa-plus json_add_row' })
                $th_key.append($add_row_btn)
            }

            // Add row
            if (edit) {
                this._renderRowEdit($table)
            } else {
                this._renderRowReadonly($table)
            }

            // Add footer
            const $tfoot = $('<tfoot>');
            $table.append($tfoot);
            const $trfoot = $('<tr>');
            $tfoot.append($trfoot);
            $trfoot.append($('<td>'), $('<td>'));
        },

        _renderRowReadonly: function ($table, path = [], deep_level = 0) {
            window.toto = this;
            var $tr = $('<tr>');
            var keys = [];
            var local_path = [];
            var is_node_object = true;
            var node;
            var $td_value;
            var value_local_path;

            if (this.schema) {
                path.push('properties');
                keys = Object.keys(objectGetPath(this.schema, path));
            } else {
                keys = Object.keys(objectGetPath(this.value, path));
            }

            keys.sort();
            for (const key of keys) {
                local_path = Object.assign([], path)
                local_path.push(key)

                if (this.schema) {
                    node = objectGetPath(this.schema, local_path);
                    is_node_object = node.type == 'object';
                    value_local_path = [];
                    for (let i = 1; i < local_path.length; i = i + 2) {
                        value_local_path.push(local_path[i]);

                    }
                } else {
                    node = objectGetPath(this.value, local_path);
                    is_node_object = typeof (node) == 'object';
                    value_local_path = local_path;
                }

                $tr = $('<tr>');
                $table.append($tr);
                $td_value = $('<td>', { class: 'o_data_cell json_value' });
                if (!is_node_object) {
                    $td_value.append(objectGetPath(this.value, value_local_path))
                }
                $tr.append(
                    $('<td>', {
                        class: 'o_data_cell json_key',
                        style: "padding-left: " + deep_level * 30 + "px",
                        text: key
                    }),
                    $td_value)


                if (is_node_object) {
                    this._renderRowReadonly($table, local_path, deep_level + 1)
                }
            }
        },

        _renderRowEdit: function ($table, path = [], deep_level = 0) {
            var $td_value;
            var $td_key;
            var $tr = $('<tr>');
            var keys = [];
            var local_path = [];
            var local_path_string;
            var is_node_object = true;
            var node;
            var value_local_path;

            if (this.schema) {
                path.push('properties');
                keys = Object.keys(objectGetPath(this.schema, path));
            } else {
                keys = Object.keys(objectGetPath(this.value, path));
            }

            keys.sort();
            for (const key of keys) {
                local_path = Object.assign([], path)
                local_path.push(key)

                if (this.schema) {
                    node = objectGetPath(this.schema, local_path);
                    is_node_object = node.type == 'object';
                    value_local_path = [];
                    for (let i = 1; i < local_path.length; i = i + 2) {
                        value_local_path.push(local_path[i]);

                    }
                    local_path_string = path_to_string(value_local_path);
                } else {
                    node = objectGetPath(this.value, local_path);
                    is_node_object = typeof (node) == 'object';
                    local_path_string = path_to_string(local_path);
                    value_local_path = local_path;
                }


                $tr = $('<tr>');
                $table.append($tr);

                $td_key = $('<td>', {
                    class: 'o_data_cell json_key',
                    style: "padding-left: " + deep_level * 30 + "px",
                    text: key,
                    key: local_path_string
                });

                if (this.schema == false) {
                    $td_key.append(
                        $('<i>', {
                            class: 'fa fa-pencil json_edit_key json_key_button',
                            text: '',
                            key: local_path_string
                        }),
                        $('<i>', {
                            class: 'fa fa-plus json_add_row json_key_button',
                            text: '',
                            key: local_path_string
                        }),
                        $('<i>', {
                            class: 'fa fa-trash-o json_delete_key json_key_button',
                            text: '',
                            key: local_path_string
                        }));
                }

                $td_value = $('<td>', { class: 'o_data_cell json_value' });
                if (!is_node_object) {
                    $td_value.append($('<input>', {
                        class: 'o_input',
                        type: this._getInputType(local_path),
                        value: objectGetPath(this.value, value_local_path),
                        key: local_path_string
                    }));
                }
                $tr.append($td_key, $td_value);

                if (is_node_object) {
                    this._renderRowEdit($table, local_path, deep_level + 1)
                }
            }
        },

        _getInputType: function (path) {
            if (this.schema) {
                return objectGetPath(this.schema, path).type;
            } else {
                return 'text';
            }
        },

        _addNewRow: function (event) {
            var local_path_string = event.target.getAttribute('key');
            var local_path = [];
            if (local_path_string != null) {
                local_path = string_to_path(local_path_string);
            }

            var newJson = Object.assign({}, this.value);
            var local_json = objectGetPath(newJson, local_path);

            if (typeof (local_json) == 'object') {
                this.savedValue = Object.assign({}, local_json);
                local_json[''] = '';
                local_path.push('')
            } else {
                const key = local_path.pop();
                local_json = objectGetPath(newJson, local_path);
                this.savedValue = local_json[key];
                local_json[key] = { '': '' };
                local_path.push(key, '');
            }
            this._setValue(newJson);
            const $button = $("i[key='" + path_to_string(local_path) + "']");
            $button.click()
        },

        _editKey: function (event) {
            const local_path_string = event.target.getAttribute('key');
            const $td_key = $("td[key='" + local_path_string + "']");
            $td_key.empty()
            const $input = $('<input>', {
                class: 'o_input input_json_edit_key',
                type: 'text',
                value: string_to_path(local_path_string).pop(),
                key: local_path_string
            });
            $td_key.append($input);
            $input.focus().select()
        },

        _deleteKey: function (event) {
            const key = event.target.getAttribute('key');
            var newJson = Object.assign({}, this.value);
            delete newJson[key];
            this._setValue(newJson);
        },

        _unEditKey: function (event) {
            const local_path_string = event.target.getAttribute('key');
            var local_path = string_to_path(local_path_string);
            var key = local_path.pop();
            if (key != '') {
                const $td_key = $("td[key='" + local_path_string + "']");
                $td_key.empty()
                $td_key.append(
                    string_to_path(local_path_string).pop(),
                    $('<i>', {
                        class: 'fa fa-pencil json_edit_key json_key_button',
                        text: '',
                        key: local_path_string
                    }),
                    $('<i>', {
                        class: 'fa fa-plus json_add_row json_key_button',
                        text: '',
                        key: local_path_string
                    }),
                    $('<i>', {
                        class: 'fa fa-trash-o json_delete_key json_key_button',
                        text: '',
                        key: local_path_string
                    }));
            } else {
                var newJson = Object.assign({}, this.value);
                key = local_path.pop();
                if (key != undefined) {
                    objectGetPath(newJson, local_path)[key] = this.savedValue;
                } else {
                    newJson = this.savedValue;
                }
                this._setValue(newJson);
            }
        },

        _valueChanged: function (event) {
            const local_path = string_to_path(event.target.getAttribute('key'));
            const key = local_path.pop();
            var local_json;

            var newJson = Object.assign({}, this.value);
            local_json = newJson;
            for (var i = 0, len = local_path.length; i < len; i++) {
                if (local_json[local_path[i]] == undefined) {
                    local_json[local_path[i]] = {};
                }
                local_json = local_json[local_path[i]]
            }

            console.log("TTTTTTTTTTTTTTTTTT " + JSON.stringify(newJson));
            local_json[key] = event.target.value;
            console.log("JJJJJJJJJJJJJ " + JSON.stringify(newJson));
            this._setValue(newJson);
        },

        _keyChanged: function (event) {
            const local_path_string = event.target.getAttribute('key');
            const newKey = event.target.value;

            var local_path = string_to_path(local_path_string);
            const key = local_path.pop()
            var new_local_path = string_to_path(local_path_string);
            new_local_path.pop();
            new_local_path.push(newKey);

            if (newKey == '') {
                return;
            } else if (objectGetPath(this.value, new_local_path) != undefined) {
                return;
            }

            var newJson = Object.assign({}, this.value);
            var local_json = objectGetPath(newJson, local_path);
            local_json[newKey] = local_json[key];
            delete local_json[key];
            this._setValue(newJson);
        },

        _parseValue: function (value) {
            return value;
        },
    });

    fieldRegistry.add('json', jsonField);

    return { jsonField: jsonField, };
}); // closing 'my_field_widget' namespace
