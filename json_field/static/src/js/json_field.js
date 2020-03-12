odoo.define('json_field_widget', function (require) {
    "use strict";
    const AbstractField = require('web.AbstractField');
    const field_registry = require('web.field_registry');
    const qweb = require('web.core').qweb;
    const time = require('web.time');

    /**
     * Get recursevely throug object
     *
     * @param {object} obj
     * @param {array} path
     * @param {boolean} build if true add intermediate object if undefiend
     */
    const objectGetPath = function (obj, path, build = false) {
        if (path == []) {
            return obj;
        }
        for (let i = 0, len = path.length; i < len; i++) {
            if (obj[path[i]] == undefined) {
                if (build) {
                    if (i != len - 1) {
                        obj[path[i]] = {};
                    } else {
                        obj[path[i]] = null;
                    }
                } else {
                    return undefined;
                }
            }
            obj = obj[path[i]];
        }

        return obj;
    };

    /**
     * Convert a double dot separated string to array path
     * and remove escaped dot from item.
     * Inverse method: path_to_string
     *
     * @param {string} string
     */
    const string_to_path = function (string) {
        const arr_path = string.split('..')
        for (let i = 0; i < arr_path.length; i++) {
            arr_path[i] = arr_path[i].replace(/\/\./g, '.');
        }
        return arr_path
    };

    /**
     * Convert path to string double dot separated
     * and escape dot from item.
     * Inverse method: string_to_path
     *
     * @param {array} path
     */
    const path_to_string = function (path) {
        const arr_string = [];
        for (let i = 0; i < path.length; i++) {
            arr_string.push(path[i].replace(/\./g, '/.'));

        }
        return arr_string.join('..')
    };

    /**
     * JsonField widget
     */
    const jsonField = AbstractField.extend({
        className: 'o_json_list',
        tagName: 'div',
        supportedFieldTypes: ['jsonb'],
        events: _.extend({}, AbstractField.prototype.events, {
            'change .json_value': '_valueChanged',
            'focusout .json_value': '_valueChanged',
            'change .json_key': '_keyChanged',
            'click .json_add_row': '_addKey',
            'click .json_edit_key': '_editKey',
            'click .json_delete_key': '_deleteKey',
            'focusout .input_json_edit_key': '_unEditKey',
        }),

        /** Initialized widget and some class value */
        init: function () {
            this._super.apply(this, arguments);

            // If there json_schema attribut is set, we set resetOnAnyFieldChange
            // to catch change on json_schema field
            if (this.attrs.json_schema) {
                this.resetOnAnyFieldChange = true;
            }

            this.savedValue = '';
        },

        // ========================================================
        // Inherited method
        // ========================================================


        _renderEdit: function () {
            this._renderTable(true);
        },

        _renderReadonly: function () {
            this._renderTable(false);
        },

        _parseValue: function (value) {
            return value;
        },

        isValid: function () {
            if (this.ajv_validator != false) {
                let valid = this.ajv_validator(this.value);
                if (!valid) {
                    this._renderError();
                }
                return valid;
            } else {
                return true;
            }
        },
        // ========================================================
        // Own methods
        // ========================================================

        /**
         * Update this.schema if json_schema attribut is set on field.
         */
        _updateSchema: function () {
            if (this.attrs.json_schema) {
                this.schema = this.recordData[this.attrs.json_schema];
            } else {
                this.schema = false;
            }

            if (this.schema) {
                this.ajv_validator = new Ajv({ allErrors: true }).compile(this.schema)
            } else {
                this.ajv_validator = false;
            }

        },

        // -------------------------------------------------------
        // Rendering
        // -------------------------------------------------------

        /**
         * Init rendering
         *
         * @param {boolean} edit Edit mode
         */
        _renderTable: function (edit) {
            this._updateSchema();

            if (this.value === false) {
                this.value = {};
            }

            this.$el.empty();

            this._renderError()

            this.$el.append(qweb.render('JsonField', { addEditButton: edit && this.schema == false }));

            this._renderRow(edit)
        },

        /**
         * Render error div if needed
         */
        _renderError: function () {

            this.$el.find("#jsonfielderror").remove()

            if (this.schema && this.ajv_validator.errors) {
                this.$el.prepend(qweb.render('JsonFieldErrors', { errors: this.ajv_validator.errors }));
            }
        },

        /**
         * Render table row
         *
         * @param {boolean} edit Edit mode
         * @param {array} path Current path
         * @param {int} deep_level Nesting level
         */
        _renderRow: function (edit, path = [], deep_level = 0) {
            let keys;
            let row_schema = {};
            const $tbody = this.$el.find('tbody')

            const param = {
                'deep_level': deep_level,
                'addEditButton': edit && this.schema == false,
                'edit': edit
            };

            // If schema is set, read keys from schema else direct read from value
            if (this.schema) {
                row_schema = objectGetPath(this.schema, path);
                path.push('properties');
                keys = Object.keys(row_schema.properties);
            } else {
                keys = Object.keys(objectGetPath(this.value, path));
            }

            keys.sort();
            for (const key of keys) {
                // Add key to path
                path.push(key);

                if (this.schema) {
                    param['is_object'] = objectGetPath(this.schema, path).type == 'object';

                    // To compute path_to_value, we take 1 out of 2 items from
                    // path to remove all "properties" items to match with value
                    // stucture
                    let path_to_value = [];
                    for (let i = 1; i < path.length; i = i + 2) {
                        path_to_value.push(path[i]);

                    }
                    param['path'] = path_to_string(path_to_value);
                    param['value'] = objectGetPath(this.value, path_to_value, true);
                } else {
                    param['value'] = objectGetPath(this.value, path)
                    param['is_object'] = (typeof (param.value) == 'object' && !Array.isArray(param.value));
                    param['path'] = path_to_string(path);
                }

                param['key'] = key;

                this._getValueParam(row_schema, param);

                $tbody.append(qweb.render('JsonFieldRow', param));

                // If current row is an object, we render next level
                if (param['is_object']) {
                    this._renderRow(edit, path, deep_level + 1);
                    //clean path from extra properties
                    path.pop()
                }

                // Clean path from key
                path.pop()
            }
        },

        /**
         * Complete param with formated value if needed and input param
         *
         * @param {object} row_schema
         * @param {object} param
         */
        _getValueParam: function (row_schema, param) {
            if (this.schema) {
                let property = row_schema.properties[param.key];
                const required_properties = row_schema.required;

                if (required_properties) {
                    param['required'] = required_properties.includes(param.key);
                }

                let type = property.type;
                // If type array, filter null from types in case we have one type and null
                // e.g. ["number", "null"] -> filter null so we have just number and
                // input will have the good number type
                if (Array.isArray(type)) {
                    type = type.filter(function (value) { return value != "null"; }).join("")
                }

                switch (type) {
                    case 'string':
                        param["json_type"] = "text";
                        switch (property.format) {
                            case "date":
                                param["input_type"] = "date";
                                if (!param.edit && param.value != undefined) {
                                    // Convert date to local format
                                    let date = moment(param['value']);
                                    if (date._isValid) {
                                        param['value'] = date.format(time.getLangDateFormat());
                                    }
                                }
                                break;
                            default:
                                param["input_type"] = "text";
                        }
                        break;
                    case 'number':
                        param["json_type"] = "number";
                        param["input_type"] = "number";
                        break;
                    case 'integer':
                        param["json_type"] = "number";
                        param["input_type"] = "integer";
                        break;
                    default:
                        param["json_type"] = "text";
                        param["input_type"] = "text";
                        break;
                }
            } else {
                param['type'] = 'text';
            }
        },

        // -------------------------------------------------------
        // Edit key
        // -------------------------------------------------------

        /**
         * Call by click on .json_add_row
         * Add an empty key and edit it
         *
         * @param {Event} event
         */
        _addKey: function (event) {
            const path_string = event.target.getAttribute('path');

            // path_string is null if we add a key on root element
            const path = (path_string != null ? string_to_path(path_string) : []);

            const newJson = Object.assign({}, this.value);
            let sub_json = objectGetPath(newJson, path);

            // If sub_json is already an object, directly add empty key
            // else convert current sub_json to object
            if (typeof (sub_json) == 'object') {
                this.savedValue = Object.assign({}, sub_json);
                sub_json[''] = '';
                path.push('')
            } else {
                let key = path.pop();
                sub_json = objectGetPath(newJson, path);
                this.savedValue = sub_json[key];
                sub_json[key] = { '': '' };
                path.push(key, '');
            }

            this._setValue(newJson);

            // Immediatly start editing key
            this._startEditKey(path_to_string(path));
        },

        /**
         * Call by click on .json_edit_key button
         *
         * @param {Event} event
         */
        _editKey: function (event) {
            this._startEditKey(event.target.getAttribute('path'));
        },

        /**
         * Redraw key cell with an input to edit key
         * @param {string} path_string Path of key to edit
         */
        _startEditKey: function (path_string) {
            const $td_key = this.$el.find("td[path='" + path_string + "']");

            $td_key.attr("editing", true);
            $td_key.empty();
            $td_key.append(qweb.render('JsonFieldRowKeyCell', {
                key: string_to_path(path_string).pop(),
                edit_key: true,
                path: path_string
            }));

            // Select value in input
            $td_key.children()[0].select()
        },

        /**
         * Call by focus out of .input_json_edit_key without any change of key
         *
         * @param {Event} event
         */
        _unEditKey: function (event) {
            const local_path_string = event.target.getAttribute('path');
            const local_path = string_to_path(local_path_string);
            let key = local_path.pop();

            // if key is not empty, it means that we were editing an already
            // existing key, so we just redraw key cell.
            if (key != '') {
                const $td_key = this.$el.find("td[path='" + local_path_string + "']");
                $td_key.empty()
                $td_key.append(qweb.render('JsonFieldRowKeyCell', {
                    key: string_to_path(local_path_string).pop(),
                    addEditButton: true,
                    path: local_path_string
                }));
            } else {
                // Else if key is empty, it means that we leave edit key of a new key
                // without giving it a value, so we delete it
                let newJson = Object.assign({}, this.value);
                key = local_path.pop();

                // If key is undefined, it means that we were adding a key on root
                // element and so savedValue contains root element
                if (key == undefined) {
                    newJson = this.savedValue;
                } else {
                    objectGetPath(newJson, local_path)[key] = this.savedValue;
                }
                this._setValue(newJson);
            }
        },

        /**
         * Call by change on .input_json_edit_key with key change
         *
         * @param {Event} event
         */
        _keyChanged: function (event) {
            const path_string = event.target.getAttribute('path');
            const newKey = event.target.value;

            // Return if newKey is empty
            if (newKey == '') {
                return;
            }

            const new_path = string_to_path(path_string);
            new_path.pop();
            new_path.push(newKey);

            // Return if new_path already exists
            if (objectGetPath(this.value, new_path) != undefined) {
                return;
            }

            const path = string_to_path(path_string);
            const oldKey = path.pop()
            const newJson = Object.assign({}, this.value);
            const sub_json = objectGetPath(newJson, path);
            sub_json[newKey] = sub_json[oldKey];
            delete sub_json[oldKey];
            this._setValue(newJson);
        },

        /**
         * Call by click on .json_delete_key button
         *
         * @param {Event} event
         */
        _deleteKey: function (event) {
            const path_string = event.target.getAttribute('path');
            const path = string_to_path(path_string);
            const key = path.pop();
            const newJson = Object.assign({}, this.value);
            delete objectGetPath(newJson, path)[key];
            this._setValue(newJson);
        },

        // -------------------------------------------------------
        // Edit value
        // -------------------------------------------------------

        /**
         * Call by change on .json_value
         * @param {Event} event
         */
        _valueChanged: function (event) {

            // Prevent change event on input type date to pass
            // only focus out must on input type date must pass
            if (event.type == "change" && event.target.getAttribute('type') == "date") {
                return
            }

            const path = string_to_path(event.target.getAttribute('path'));
            const json_type = event.target.getAttribute('json-type');
            const key = path.pop();


            let value = event.target.value;
            // In case of empty value, we set it to null
            if (value == '') {
                value = null;
            } else {
                // Cast value if json_type is defined
                switch (json_type) {
                    case "number":
                        value = Number(value);
                        break;
                }
            }

            const newJson = Object.assign({}, this.value);
            let sub_json = objectGetPath(newJson, path, true)

            sub_json[key] = value;

            this._setValue(newJson);
        },

    });

    field_registry.add('json', jsonField);

    return { jsonField: jsonField, };
});
