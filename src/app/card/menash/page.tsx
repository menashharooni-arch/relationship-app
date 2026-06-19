import SaveContactButton from "@/components/SaveContactButton";

const person = {
  name: "Menash Harooni",
  title: "Founder",
  company: "Evercard",
  email: "menashharooni@gmail.com",
  phone: "(516) 829-0348",
  website: "relationship-app-alpha.vercel.app",
};

export default function CardPage() {
  const initials = person.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header band */}
        <div className="bg-blue-600 h-24 w-full" />

        {/* Card body */}
        <div className="px-8 pb-8 -mt-12 flex flex-col items-center">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-white shadow-md border-4 border-white flex items-center justify-center text-blue-600 text-3xl font-bold">
            {initials}
          </div>

          {/* Name & role */}
          <h1 className="mt-4 text-2xl font-bold text-gray-900 text-center">
            {person.name}
          </h1>
          <p className="text-blue-600 font-medium text-sm mt-0.5">
            {person.title}
          </p>
          <p className="text-gray-400 text-sm">{person.company}</p>

          {/* Divider */}
          <hr className="my-6 border-gray-100 w-full" />

          {/* Contact rows */}
          <div className="w-full space-y-4">
            <a
              href={`mailto:${person.email}`}
              className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <span className="text-xl">✉️</span>
              <span className="text-sm">{person.email}</span>
            </a>
            <a
              href={`tel:${person.phone}`}
              className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <span className="text-xl">📞</span>
              <span className="text-sm">{person.phone}</span>
            </a>
            <a
              href={`https://${person.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <span className="text-xl">🌐</span>
              <span className="text-sm">{person.website}</span>
            </a>
          </div>

          {/* Save Contact */}
          <div className="mt-8 w-full">
            <SaveContactButton person={person} />
          </div>

          {/* Branding */}
          <p className="mt-6 text-xs text-gray-300">Powered by Evercard</p>
        </div>
      </div>
    </main>
  );
}
