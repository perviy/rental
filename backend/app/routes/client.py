import os
from flask import Blueprint, jsonify, send_from_directory, request, current_app
from ..models import Apartment
from ..schemas import apartment_schema, apartments_schema

client_bp = Blueprint("client", __name__)


@client_bp.route("/apartments", methods=["GET"])
def list_apartments():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 12, type=int)

    query = Apartment.query

    # Simple filters
    city = request.args.get("city")
    rooms = request.args.get("rooms", type=int)
    floor = request.args.get("floor", type=int)

    if city:
        query = query.filter(Apartment.city.ilike(f"%{city}%"))
    if rooms:
        query = query.filter(Apartment.rooms == rooms)
    if floor:
        query = query.filter(Apartment.floor == floor)

    pagination = query.order_by(Apartment.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify(
        {
            "apartments": apartments_schema.dump(pagination.items),
            "total": pagination.total,
            "pages": pagination.pages,
            "page": page,
        }
    )


@client_bp.route("/apartments/<int:apt_id>", methods=["GET"])
def get_apartment(apt_id):
    apt = Apartment.query.get_or_404(apt_id)
    return jsonify(apartment_schema.dump(apt))


@client_bp.route("/images/<path:filename>", methods=["GET"])
def serve_image(filename):
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    return send_from_directory(upload_folder, filename)
