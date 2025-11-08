import { motion } from 'framer-motion';

const Portfolio = () => {
  const projects = [
    {
      title: 'Interactive Dashboard',
      description: 'A sleek dashboard for monitoring automotive performance data with real-time visualizations.',
      tech: ['React', 'D3.js', 'Node.js'],
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'E-Commerce Platform',
      description: 'Modern e-commerce site with advanced filtering, search, and responsive design.',
      tech: ['React', 'TypeScript', 'Tailwind'],
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Code Editor Tool',
      description: 'Collaborative code editor with syntax highlighting and real-time collaboration features.',
      tech: ['React', 'Socket.io', 'Monaco'],
      gradient: 'from-green-500 to-teal-500'
    },
    {
      title: 'Automotive Configurator',
      description: 'Interactive tool for customizing car features with 3D visualization.',
      tech: ['Three.js', 'React', 'WebGL'],
      gradient: 'from-red-500 to-orange-500'
    },
    {
      title: 'Personal Finance App',
      description: 'Budget tracking app with beautiful charts and expense categorization.',
      tech: ['React Native', 'Chart.js', 'Firebase'],
      gradient: 'from-indigo-500 to-purple-500'
    },
    {
      title: 'Weather Analytics',
      description: 'Advanced weather forecasting with historical data analysis and predictions.',
      tech: ['Python', 'React', 'ML'],
      gradient: 'from-sky-500 to-blue-500'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen py-20 px-4 pt-24"
    >
      <div className="max-w-7xl mx-auto">
        <motion.h1
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl font-bold text-center mb-16 text-white"
        >
          My Portfolio
        </motion.h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <motion.div
              key={project.title}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ y: -10 }}
              className="group relative bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-2xl overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${project.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-300`}></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-3 text-white">{project.title}</h3>
                <p className="text-gray-300 mb-4 leading-relaxed">{project.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tech.map((tech) => (
                    <span
                      key={tech}
                      className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-full font-semibold shadow-lg hover:shadow-xl transition"
                >
                  View Project
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default Portfolio;
