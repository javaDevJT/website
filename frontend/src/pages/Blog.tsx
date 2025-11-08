import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

interface BlogPost {
  id: number;
  title: string;
  summary: string;
  content: string;
  author: string;
  createdDate: string;
  tags: string;
}

const Blog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    axios.get('/api/blog')
      .then(response => setPosts(response.data))
      .catch(error => console.error('Error fetching blog posts:', error));
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen py-20 px-4 pt-24"
    >
      <div className="max-w-4xl mx-auto">
        <motion.h1
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-5xl font-bold text-center mb-16 text-white"
        >
          Blog
        </motion.h1>
        <div className="space-y-8">
          {posts.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl cursor-pointer"
            >
              <h2 className="text-3xl font-bold mb-4 text-white">{post.title}</h2>
              <p className="text-gray-300 mb-4 leading-relaxed">{post.summary}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">By {post.author} on {new Date(post.createdDate).toLocaleDateString()}</p>
                {post.tags && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.split(',').map(tag => (
                      <span key={tag} className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.article>
          ))}
          {posts.length === 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center text-gray-400 text-xl"
            >
              No blog posts yet. Stay tuned!
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default Blog;
