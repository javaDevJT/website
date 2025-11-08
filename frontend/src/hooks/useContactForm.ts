import { useState } from 'react';
import axios from 'axios';

export type ContactFormField = 'name' | 'email' | 'message' | 'complete';

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export interface UseContactFormReturn {
  currentField: ContactFormField;
  formData: ContactFormData;
  error: string | null;
  isSubmitting: boolean;
  handleInput: (value: string) => Promise<string>;
  reset: () => void;
}

const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const useContactForm = (): UseContactFormReturn => {
  const [currentField, setCurrentField] = useState<ContactFormField>('name');
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    message: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInput = async (value: string): Promise<string> => {
    setError(null);

    switch (currentField) {
      case 'name':
        if (!value.trim()) {
          setError('Name cannot be empty');
          return 'Error: Name cannot be empty. Please try again.';
        }
        setFormData(prev => ({ ...prev, name: value.trim() }));
        setCurrentField('email');
        return 'Email address:';

      case 'email':
        if (!validateEmail(value.trim())) {
          setError('Invalid email format');
          return 'Error: Invalid email format. Please enter a valid email address:';
        }
        setFormData(prev => ({ ...prev, email: value.trim() }));
        setCurrentField('message');
        return 'Message (press Enter twice to submit):';

      case 'message':
        if (!value.trim()) {
          setError('Message cannot be empty');
          return 'Error: Message cannot be empty. Please enter your message:';
        }
        setFormData(prev => ({ ...prev, message: value.trim() }));
        setCurrentField('complete');
        
        // Submit the form
        setIsSubmitting(true);
        try {
          const dataToSubmit = {
            ...formData,
            message: value.trim(),
          };

          const apiResponse = await axios.post('/api/contact', dataToSubmit);
          const result = apiResponse.data;
          
          // Build success message with email status
          const emailStatusLine = result.emailSent 
            ? '║  ✓ Email notification sent successfully                   ║'
            : '║  ⚠ Message saved (email notifications disabled)           ║';
          
          const response = `
╔════════════════════════════════════════════════════════════╗
║                  MESSAGE SENT SUCCESSFULLY                 ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Thank you for reaching out, ${dataToSubmit.name.padEnd(32)}║
║                                                            ║
║  I'll get back to you at ${dataToSubmit.email.padEnd(30)} ║
║  as soon as possible!                                      ║
║                                                            ║
${emailStatusLine}
║                                                            ║
║  Summary:                                                  ║
║  • Name: ${dataToSubmit.name.padEnd(48)}║
║  • Email: ${dataToSubmit.email.padEnd(47)}║
║  • Message: ${dataToSubmit.message.substring(0, 44).padEnd(44)}║
${dataToSubmit.message.length > 44 ? `║             ${dataToSubmit.message.substring(44, 88).padEnd(44)}║` : ''}
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`;
          reset();
          return response;
        } catch (err: any) {
          setIsSubmitting(false);
          const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to send message. Please try again later.';
          return `Error: ${errorMsg}\n\nPlease try again or contact me directly at noreply@javadevjt.tech`;
        }

      default:
        return 'Contact form completed. Type "contact" to start a new message.';
    }
  };

  const reset = () => {
    setCurrentField('name');
    setFormData({ name: '', email: '', message: '' });
    setError(null);
    setIsSubmitting(false);
  };

  return {
    currentField,
    formData,
    error,
    isSubmitting,
    handleInput,
    reset,
  };
};
