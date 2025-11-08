# Joshua Terk Personal Website

A modern personal website showcasing impressive UI design with a focus on technology and automotive interests. Built with Spring Boot (backend) and React with TypeScript (frontend), featuring Tailwind CSS and Framer Motion animations.

## Features

- **Home Page**: Animated hero section with tech and automotive themes
- **About Page**: Personal story and skills
- **Portfolio Page**: Showcase of UI designs and projects
- **Blog Page**: Dynamic blog with CMS backend
- **Contact Page**: Functional contact form with backend processing
- **Responsive Design**: Works on all devices
- **Animations**: Smooth transitions using Framer Motion

## Prerequisites

- Java 25 or later
- Maven 3.6+ (Maven Wrapper included)
- Node.js 18+ and npm (for frontend build)

## Getting Started

### 1. Clone the Repository
```bash
git clone <repository-url>
cd website
```

### 2. Backend Setup
The backend uses Spring Boot with JPA and H2 database.

- Run Maven to build and install dependencies:
```bash
./mvnw clean install
```

### 3. Frontend Setup
The frontend is built with React, TypeScript, and Tailwind CSS.

- Navigate to the frontend directory:
```bash
cd frontend
```

- Install dependencies:
```bash
npm install
```

- Build the frontend (this will output to `../src/main/resources/static`):
```bash
npm run build
```

- Return to root:
```bash
cd ..
```

### 4. Run the Application
Start the Spring Boot application, which serves both backend APIs and the built frontend:

```bash
./mvnw spring-boot:run
```

The application will start on http://localhost:8080.

### 5. Access the Website
Open your browser and go to:
- **Website**: http://localhost:8080
- **API Endpoints**:
  - Blog posts: http://localhost:8080/api/blog
  - Contact form: http://localhost:8080/api/contact

## Development

### Running Frontend in Development Mode
For frontend development with hot reload:

```bash
cd frontend
npm run dev
```

This starts the Vite dev server on http://localhost:3000. Note: CORS is configured for development.

### Database
- Uses H2 in-memory database for development.
- Data persists only during runtime; restart clears data.

### Building for Production
To build the complete application:

```bash
./mvnw clean package
```

This creates a JAR file in `target/` that can be run with:
```bash
java -jar target/website-0.0.1-SNAPSHOT.jar
```

## Project Structure

```
website/
├── src/main/java/com/jtdev/website/
│   ├── controller/     # REST controllers (Blog, Contact)
│   ├── model/          # JPA entities (BlogPost, ContactMessage)
│   ├── repository/     # JPA repositories
│   └── WebsiteApplication.java
├── src/main/resources/static/  # Built frontend assets
├── frontend/           # React frontend source
│   ├── src/
│   │   ├── pages/      # React components (Home, About, etc.)
│   │   └── App.tsx
│   └── package.json
├── pom.xml             # Maven configuration
└── README.md
```

## Technologies Used

- **Backend**: Spring Boot, Spring Data JPA, H2 Database, Spring WebFlux
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion, Axios
- **Build Tools**: Maven, Vite

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and ensure builds pass
5. Submit a pull request

## License

This project is licensed under the MIT License.
