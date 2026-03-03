import os
import uuid
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import create_access_token, jwt_required
from PIL import Image
from ..models import db, Apartment, ApartmentImage
from ..schemas import apartment_schema, apartments_schema

admin_bp = Blueprint("admin", __name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_image(file):
    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_folder, exist_ok=True)
    path = os.path.join(upload_folder, filename)

    img = Image.open(file)
    img = img.convert("RGB")
    # Resize if too large, keep aspect ratio
    max_size = (1920, 1080)
    img.thumbnail(max_size, Image.LANCZOS)
    img.save(path, "JPEG", quality=85, optimize=True)

    return filename


# ── Auth ──────────────────────────────────────────────────────────────────────


@admin_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    login = data.get("login", "")
    password = data.get("password", "")

    if (
        login == current_app.config["ADMIN_LOGIN"]
        and password == current_app.config["ADMIN_PASSWORD"]
    ):
        token = create_access_token(identity="admin")
        return jsonify({"access_token": token})

    return jsonify({"error": "Invalid credentials"}), 401


# ── Apartments CRUD ───────────────────────────────────────────────────────────


@admin_bp.route("/apartments", methods=["GET"])
@jwt_required()
def list_apartments():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    pagination = Apartment.query.order_by(Apartment.created_at.desc()).paginate(
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


@admin_bp.route("/apartments", methods=["POST"])
@jwt_required()
def create_apartment():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    errors = apartment_schema.validate(data)
    if errors:
        return jsonify({"errors": errors}), 422

    apt = Apartment(
        area=data["area"],
        rooms=data["rooms"],
        floor=data["floor"],
        city=data["city"],
        region=data["region"],
        street=data["street"],
        building=data["building"],
        apt_number=data["apt_number"],
        phone=data["phone"],
        features=data.get("features"),
    )
    db.session.add(apt)
    db.session.commit()
    return jsonify(apartment_schema.dump(apt)), 201


@admin_bp.route("/apartments/<int:apt_id>", methods=["PUT"])
@jwt_required()
def update_apartment(apt_id):
    apt = Apartment.query.get_or_404(apt_id)
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    fields = [
        "area", "rooms", "floor", "city", "region",
        "street", "building", "apt_number", "phone", "features",
    ]
    for field in fields:
        if field in data:
            setattr(apt, field, data[field])

    db.session.commit()
    return jsonify(apartment_schema.dump(apt))


@admin_bp.route("/apartments/<int:apt_id>", methods=["DELETE"])
@jwt_required()
def delete_apartment(apt_id):
    apt = Apartment.query.get_or_404(apt_id)

    # Remove image files from disk
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    for img in apt.images:
        path = os.path.join(upload_folder, img.filename)
        if os.path.exists(path):
            os.remove(path)

    db.session.delete(apt)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


# ── Images ────────────────────────────────────────────────────────────────────


@admin_bp.route("/apartments/<int:apt_id>/images", methods=["POST"])
@jwt_required()
def upload_images(apt_id):
    apt = Apartment.query.get_or_404(apt_id)
    files = request.files.getlist("images")

    if not files:
        return jsonify({"error": "No images provided"}), 400

    saved = []
    current_max_order = max((img.order for img in apt.images), default=-1)

    for i, file in enumerate(files):
        if file and allowed_file(file.filename):
            filename = save_image(file)
            img = ApartmentImage(
                apartment_id=apt.id,
                filename=filename,
                order=current_max_order + i + 1,
            )
            db.session.add(img)
            saved.append(filename)

    db.session.commit()
    return jsonify({"uploaded": saved, "apartment": apartment_schema.dump(apt)}), 201


@admin_bp.route("/images/<int:image_id>", methods=["DELETE"])
@jwt_required()
def delete_image(image_id):
    img = ApartmentImage.query.get_or_404(image_id)
    upload_folder = current_app.config["UPLOAD_FOLDER"]
    path = os.path.join(upload_folder, img.filename)
    if os.path.exists(path):
        os.remove(path)
    db.session.delete(img)
    db.session.commit()
    return jsonify({"message": "Image deleted"}), 200
