from marshmallow import Schema, fields


class ApartmentImageSchema(Schema):
    id = fields.Int(dump_only=True)
    filename = fields.Str()
    order = fields.Int()
    url = fields.Method("get_url")

    def get_url(self, obj):
        return f"/api/images/{obj.filename}"


class ApartmentSchema(Schema):
    id = fields.Int(dump_only=True)
    area = fields.Float(required=True)
    rooms = fields.Int(required=True)
    floor = fields.Int(required=True)
    city = fields.Str(required=True)
    region = fields.Str(required=True)
    street = fields.Str(required=True)
    building = fields.Str(required=True)
    apt_number = fields.Str(required=True)
    phone = fields.Str(required=True)
    features = fields.Str(allow_none=True)
    created_at = fields.DateTime(dump_only=True)
    images = fields.List(fields.Nested(ApartmentImageSchema), dump_only=True)


apartment_schema = ApartmentSchema()
apartments_schema = ApartmentSchema(many=True)
