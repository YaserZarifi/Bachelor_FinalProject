import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';

// Import Leaflet CSS and default icons
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for missing marker icons in React-Leaflet + Vite
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Initialize Axios with the Django backend URL
const api = axios.create({
  baseURL: 'http://localhost:8080/api/',
});

// Component to handle map clicks and drop a marker
function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

export default function App() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [position, setPosition] = useState(null);
  const [image, setImage] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch urban categories from Django on component mount
  useEffect(() => {
    api.get('categories/')
      .then(response => setCategories(response.data))
      .catch(error => console.error("Error fetching categories:", error));
  }, []);

  // Handle image file selection
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  // Submit the complete report to the backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!selectedCategory || !description || !position || !image) {
      setStatusMessage('⚠️ Please fill all fields and pin a location on the map.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('🚀 Sending report to city officials...');

    // Use FormData to handle multipart/form-data (required for image uploads)
    const formData = new FormData();
    formData.append('category', selectedCategory);
    formData.append('description', description);
    formData.append('image_before', image);

    // Convert GPS coordinates to WKT (Well-Known Text) format for PostGIS
    formData.append('location', `POINT(${position.lng} ${position.lat})`);

    try {
      await api.post('reports/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setStatusMessage('✅ Report submitted successfully!');

      // Reset form fields after successful submission
      setSelectedCategory('');
      setDescription('');
      setPosition(null);
      setImage(null);
      e.target.reset(); // Reset file input

    } catch (error) {
      console.error(error);
      setStatusMessage('❌ Error submitting the report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 flex items-center justify-center font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header Section */}
        <div className="bg-blue-600 py-6 px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white">شهریاور</h2>
          <p className="text-blue-100 mt-2 text-sm">سیستم هوشمند گزارش‌دهی معضلات شهری</p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">

          <div>
            <label className="block text-gray-700 font-semibold mb-2">نوع مشکل</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="">یک دسته‌بندی انتخاب کنید...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">توضیحات</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              placeholder="لطفاً مشکل را شرح دهید..."
              className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            ></textarea>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">موقعیت مکانی (روی نقشه کلیک کنید)</label>
            <div className="h-64 w-full rounded-lg overflow-hidden border-2 border-gray-200 shadow-inner z-0 relative">
              <MapContainer center={[35.7000, 51.4000]} zoom={12} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationMarker position={position} setPosition={setPosition} />
              </MapContainer>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-semibold mb-2">تصویر مشکل</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
            />
          </div>

          {statusMessage && (
            <div className={`p-3 rounded-lg text-sm font-medium ${statusMessage.includes('✅') ? 'bg-green-100 text-green-800' : statusMessage.includes('❌') || statusMessage.includes('⚠️') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
              {statusMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full text-white font-bold py-3 rounded-lg shadow-md transition-colors duration-300 ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting ? 'در حال ارسال...' : 'ثبت نهایی گزارش'}
          </button>
        </form>

      </div>
    </div>
  );
}
