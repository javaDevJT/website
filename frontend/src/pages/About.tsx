import { motion } from 'framer-motion';

const About = () => {
  const skills = [
    'UI/UX Design', 'Frontend Development', 'Backend Development', 'Automotive Tech', 'Data Visualization'
  ];

  const timeline = [
    { year: '2020', event: 'Started learning web development' },
    { year: '2021', event: 'Built first full-stack application' },
    { year: '2022', event: 'Explored automotive ECU tuning' },
    { year: '2023', event: 'Focused on UI design and animations' },
    { year: '2024', event: 'Developed personal projects and portfolio' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen py-20 px-4 pt-24"
    >
      <div className="max-w-6xl mx-auto">
        <motion.h1
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl font-bold text-center mb-12 text-white"
        >
          About Me
        </motion.h1>

        <div className="grid md:grid-cols-2 gap-12">
          <motion.div
            initial={{ x: -50 }}
            animate={{ x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl"
          >
            <h2 className="text-3xl font-semibold mb-6 text-white">My Story</h2>
            <p className="text-gray-300 leading-relaxed mb-6">
              Hi, I'm Joshua Terk. I'm passionate about the intersection of technology and automotive worlds.
              From crafting elegant code to tuning high-performance engines, I thrive on blending creativity with engineering precision.
            </p>
            <p className="text-gray-300 leading-relaxed">
              My journey spans from developing responsive web applications to exploring automotive diagnostics and customization.
              I believe in creating experiences that are both functional and visually stunning.
            </p>
          </motion.div>

          <motion.div
            initial={{ x: 50 }}
            animate={{ x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl"
          >
            <h2 className="text-3xl font-semibold mb-6 text-white">Skills</h2>
            <div className="grid grid-cols-2 gap-4">
              {skills.map((skill, index) => (
                <motion.div
                  key={skill}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white font-medium text-center shadow-lg"
                >
                  {skill}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-16 bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl"
        >
          <h2 className="text-3xl font-semibold mb-8 text-white text-center">My Journey</h2>
          <div className="space-y-6">
            {timeline.map((item, index) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.2 }}
                className="flex items-center space-x-4"
              >
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold px-4 py-2 rounded-full min-w-fit">
                  {item.year}
                </div>
                <div className="flex-1 bg-white/20 rounded-lg p-4">
                  <p className="text-gray-300">{item.event}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default About;
