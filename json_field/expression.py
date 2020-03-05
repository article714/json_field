from odoo.osv import expression

expression.TERM_OPERATORS = expression.TERM_OPERATORS + ("json",)

JSON_OPERATOR = ("->>", "->")
CAST = ("::INT", "::DATE")


class JsonExpression(expression.expression):
    def _expression__leaf_to_sql(self, eleaf):
        left, operator, right = eleaf.leaf

        if operator == "json":

            json_operator = []
            params = []
            cast = ""
            for element in right:
                if element in JSON_OPERATOR:
                    json_operator.append(element)
                elif element.upper() in CAST:
                    cast = element
                elif element in expression.TERM_OPERATORS:
                    sql_operator = element
                    break
                else:
                    json_operator.append("%s")
                    params.append(element)

            column = '"{}".{}'.format(eleaf.generate_alias(), expression._quote(left))
            query = "(({}{}){} {} %s)".format(
                column, "".join(json_operator), cast, sql_operator
            )
            params.append(right[-1])

            return query, params

        return super(JsonExpression, self)._expression__leaf_to_sql(eleaf)
