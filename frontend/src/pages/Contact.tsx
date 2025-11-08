import { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    axios.post('/api/contact', formData)
      .then(() => {
        setSubmitted(true);
        setFormData({ name: '', email: '', message: '' });
      })
      .catch(error => console.error('Error submitting contact form:', error));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen py-20 px-4 pt-24"
    >
      <div className="max-w-2xl mx-auto">
        <motion.h1
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl font-bold text-center mb-16 text-white"
        >
          Contact Me
        </motion.h1>
        {submitted ? (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-center bg-green-500/20 backdrop-blur-md rounded-2xl p-8 shadow-2xl"
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-green-300 mb-4">Thank you!</h2>
            <p className="text-gray-300">Your message has been sent successfully. I'll get back to you soon!</p>
          </motion.div>
        ) : (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ y: 50 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl"
          >
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-white">Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-white">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your.email@example.com"
              />
            </div>
            <div className="mb-8">
              <label className="block text-sm font-medium mb-2 text-white">Message</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={6}
                className="w-full p-4 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Tell me about your project or just say hello!"
              ></textarea>
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold shadow-lg hover:shadow-xl transition"
            >
              Send Message
            </motion.button>
          </motion.form>
        )}
      </div>
    </motion.div>
  );
};

export default Contact;
