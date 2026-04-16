from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from contextlib import contextmanager
import os
from dotenv import load_dotenv
import certifi

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "invoice_app")

class MongoDBConnection:
    client = None
    db = None

    @classmethod
    def connect_db(cls):
        """Initialize MongoDB connection"""
        try:
            mongo_kwargs = {"serverSelectionTimeoutMS": 5000}
            if MONGODB_URL.startswith("mongodb+srv://"):
                mongo_kwargs["tls"] = True
                mongo_kwargs["tlsCAFile"] = certifi.where()
            cls.client = MongoClient(MONGODB_URL, **mongo_kwargs)
            cls.client.admin.command('ping')
            cls.db = cls.client[DATABASE_NAME]
            print(f"✓ Connected to MongoDB: {DATABASE_NAME}")
            return cls.db
        except ServerSelectionTimeoutError:
            print(f"✗ Failed to connect to MongoDB at {MONGODB_URL}")
            raise

    @classmethod
    def get_db(cls):
        """Get database instance"""
        if cls.db is None:
            cls.connect_db()
        return cls.db

    @classmethod
    def close_db(cls):
        """Close database connection"""
        if cls.client:
            cls.client.close()
            print("✓ MongoDB connection closed")

# Initialize collections
def init_collections():
    db = MongoDBConnection.get_db()
    
    # Users collection
    if "users" not in db.list_collection_names():
        db.create_collection("users")
        db["users"].create_index("email", unique=True)
    
    # Uploads collection
    if "uploads" not in db.list_collection_names():
        db.create_collection("uploads")
        db["uploads"].create_index("user_id")
        db["uploads"].create_index("created_at")
    
    # Results collection
    if "results" not in db.list_collection_names():
        db.create_collection("results")
        db["results"].create_index("upload_id")
        db["results"].create_index("user_id")
    
    print("✓ Collections initialized")
