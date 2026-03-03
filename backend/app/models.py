from datetime import datetime
from . import db


class Apartment(db.Model):
    __tablename__ = "apartments"

    id = db.Column(db.Integer, primary_key=True)
    area = db.Column(db.Float, nullable=False)
    rooms = db.Column(db.Integer, nullable=False)
    floor = db.Column(db.Integer, nullable=False)

    # Address
    city = db.Column(db.String(100), nullable=False)
    region = db.Column(db.String(100), nullable=False)
    street = db.Column(db.String(200), nullable=False)
    building = db.Column(db.String(20), nullable=False)
    apt_number = db.Column(db.String(20), nullable=False)

    phone = db.Column(db.String(30), nullable=False)
    features = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    images = db.relationship(
        "ApartmentImage",
        backref="apartment",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="ApartmentImage.order",
    )

    def address(self):
        return f"{self.city}, {self.region} обл., вул. {self.street}, буд. {self.building}, кв. {self.apt_number}"


class ApartmentImage(db.Model):
    __tablename__ = "apartment_images"

    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(
        db.Integer, db.ForeignKey("apartments.id"), nullable=False
    )
    filename = db.Column(db.String(255), nullable=False)
    order = db.Column(db.Integer, default=0)
