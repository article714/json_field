odoo.define('json_field_widget', function (require) {
    "use strict";
    const AbstractField = require('web.AbstractField');
    const fieldRegistry = require('web.field_registry');
    const core = require('web.core');
    const qweb = core.qweb

    /**
     * Get recursevely throug object
     *
     * @param {object} obj
     * @param {array} path
     */
    const objectGetPath = function (obj, path) {
        if (path == []) {
            return obj;
        }
        for (let i = 0, len = path.length; i < len; i++) {
            obj = obj[path[i]];
            if (obj == undefined) {
                return obj;
            }
        };
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

        _renderEdit: function () {
            this._renderTable(true);
        },

        _renderReadonly: function () {
            this._renderTable(false);
        },

        _parseValue: function (value) {
            return value;
        },

        /**
         * Update this.schema if json_schema attribut is set on field.
         */
        _updateSchema: function () {
            if (this.attrs.json_schema) {
                this.schema = this.recordData[this.attrs.json_schema];
            } else {
                this.schema = false;
            }
        },

        /**
         * Init rendering
         *
         * @param {boolean} edit Edit mode
         */
        _renderTable: function (edit) {
            this._updateSchema();

            this.$el.empty();

            this.$el.append(qweb.render('JsonField', { edit: edit }));

            this._renderRow(edit)
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
            let path_to_value;
            const $tbody = this.$el.find('tbody')

            const param = {
                'deep_level': deep_level,
                'addEditButton': edit & this.schema == false,
                'edit': edit
            };

            // If schema is set, read keys from schema else direct read from value
            if (this.schema) {
                path.push('properties');
                keys = Object.keys(objectGetPath(this.schema, path));
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
                    path_to_value = [];
                    for (let i = 1; i < path.length; i = i + 2) {
                        path_to_value.push(path[i]);

                    }
                    param['path'] = path_to_string(path_to_value);
                } else {
                    param['is_object'] = typeof (objectGetPath(this.value, path)) == 'object';
                    param['path'] = path_to_string(path);
                    path_to_value = path;
                }

                param['key'] = key;
                param['type'] = this._getInputType(path);
                param['value'] = objectGetPath(this.value, path_to_value);

                $tbody.append(qweb.render('JsonFieldRow', param));

                // If current row is an object, we render next level
                if (param['is_object']) {
                    this._renderRow(edit, path, deep_level + 1);
                }

                // Clean path from key
                path.pop()
            }
        },

        _getInputType: function (path) {
            if (this.schema) {
                return objectGetPath(this.schema, path).type;
            } else {
                return 'text';
            }
        },

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

        /**
         * Call by change on .json_value
         * @param {Event} event
         */
        _valueChanged: function (event) {
            const path = string_to_path(event.target.getAttribute('path'));
            const key = path.pop();
            let sub_json;

            const newJson = Object.assign({}, this.value);
            sub_json = newJson;

            // Loop recurcively over sub_json to create all needed path level
            for (let i = 0, len = path.length; i < len; i++) {
                if (sub_json[path[i]] == undefined) {
                    sub_json[path[i]] = {};
                }
                sub_json = sub_json[path[i]];
            }

            sub_json[key] = event.target.value;

            this._setValue(newJson);
        },

    });

    fieldRegistry.add('json', jsonField);

    return { jsonField: jsonField, };
});
