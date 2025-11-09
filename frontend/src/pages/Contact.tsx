import { motion } from 'framer-motion';

const contactInfo = [
  {
    label: 'Email',
    value: 'joshterk@javadevjt.tech',
    href: 'mailto:joshterk@javadevjt.tech',
  },
  {
    label: 'LinkedIn',
    value: 'linkedin.com/in/joshuaterk',
    href: 'https://www.linkedin.com/in/joshuaterk/',
  },
];

const Contact = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen py-20 px-4 pt-24"
    >
      <div className="max-w-2xl mx-auto text-center">
        <motion.h1
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl font-bold text-center mb-16 text-white"
        >
          Contact Me
        </motion.h1>
        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-md p-10 rounded-2xl shadow-2xl border border-white/10"
        >
          <p className="text-gray-300 mb-10 text-lg">
            No forms, no friction—reach out directly using the details below.
          </p>
          <div className="space-y-6">
            {contactInfo.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="block bg-black/30 border border-white/10 rounded-xl p-6 text-left hover:border-blue-400 transition"
                target="_blank"
                rel="noreferrer"
              >
                <p className="text-sm uppercase tracking-widest text-blue-300 mb-2">{item.label}</p>
                <p className="text-2xl font-semibold text-white">{item.value}</p>
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Contact;
