package com.jtdev.website.service;

import com.jtdev.website.model.ContactMessage;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;

/**
 * Email notification service for contact form submissions.
 * Only enabled when email credentials are configured via environment variables.
 * 
 * Required environment variables:
 * - MAIL_USERNAME: Gmail address (e.g., noreply@javadevjt.tech)
 * - MAIL_PASSWORD: Gmail app password
 * - MAIL_RECIPIENT: Email address to receive notifications
 * - MAIL_ENABLED: Set to 'true' to enable email sending
 */
@Service
@ConditionalOnProperty(
    name = "contact.email.enabled",
    havingValue = "true"
)
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final String recipientEmail;
    private final String fromEmail;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${contact.email.recipient}") String recipientEmail,
            @Value("${spring.mail.username}") String fromEmail) {
        this.mailSender = mailSender;
        this.recipientEmail = recipientEmail;
        this.fromEmail = fromEmail;
        log.info("EmailService initialized - notifications will be sent to: {}", recipientEmail);
    }

    /**
     * Send email notification asynchronously when a contact form is submitted.
     * 
     * @param contactMessage The contact message to send
     * @throws MessagingException if email sending fails
     */
    @Async
    public void sendContactNotification(ContactMessage contactMessage) throws MessagingException {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            // Email configuration
            helper.setFrom(fromEmail);
            helper.setTo(recipientEmail);
            helper.setReplyTo(contactMessage.getEmail());
            helper.setSubject("New Contact Form Submission - " + contactMessage.getName());

            // Email body (HTML formatted)
            String htmlContent = buildEmailBody(contactMessage);
            helper.setText(htmlContent, true);

            // Send email
            mailSender.send(message);
            
            log.info("Contact notification email sent successfully for: {} ({})", 
                    contactMessage.getName(), contactMessage.getEmail());
                    
        } catch (Exception e) {
            log.error("Failed to send contact notification email for: {} ({})", 
                    contactMessage.getName(), contactMessage.getEmail(), e);
            throw new MessagingException("Failed to send email notification", e);
        }
    }

    /**
     * Build HTML email body with contact form details
     */
    private String buildEmailBody(ContactMessage contactMessage) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        String formattedDate = contactMessage.getSubmittedDate() != null 
            ? contactMessage.getSubmittedDate().format(formatter)
            : "Unknown";

        return """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #00ff00; color: #000; padding: 20px; text-align: center; }
                    .content { background: #f4f4f4; padding: 20px; margin-top: 20px; }
                    .field { margin-bottom: 15px; }
                    .label { font-weight: bold; color: #555; }
                    .value { margin-left: 10px; }
                    .message-box { background: white; padding: 15px; border-left: 4px solid #00ff00; margin-top: 10px; }
                    .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔔 New Contact Form Submission</h1>
                    </div>
                    
                    <div class="content">
                        <div class="field">
                            <span class="label">From:</span>
                            <span class="value">%s</span>
                        </div>
                        
                        <div class="field">
                            <span class="label">Email:</span>
                            <span class="value"><a href="mailto:%s">%s</a></span>
                        </div>
                        
                        <div class="field">
                            <span class="label">Submitted:</span>
                            <span class="value">%s</span>
                        </div>
                        
                        <div class="field">
                            <span class="label">Message:</span>
                            <div class="message-box">
                                %s
                            </div>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>This email was sent from your portfolio website contact form.</p>
                        <p>To reply, use the email address above or click reply to this message.</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(
                escapeHtml(contactMessage.getName()),
                contactMessage.getEmail(),
                escapeHtml(contactMessage.getEmail()),
                formattedDate,
                escapeHtml(contactMessage.getMessage()).replace("\n", "<br>")
            );
    }

    /**
     * Simple HTML escaping to prevent XSS
     */
    private String escapeHtml(String text) {
        if (text == null) return "";
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;")
                   .replace("'", "&#39;");
    }

    /**
     * Check if email service is available
     */
    public boolean isEnabled() {
        return true; // This bean only exists if enabled
    }
}
