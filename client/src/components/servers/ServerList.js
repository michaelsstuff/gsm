import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Spinner, Alert, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const ServerList = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await axios.get('/api/servers');
        setServers(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching servers:', err);
        setError('Failed to load game servers. Please try again later.');
        setLoading(false);
      }
    };

    fetchServers();
  }, []);

  const getStatusBadge = (status) => {
    let variant;
    switch (status) {
      case 'running':
        variant = 'success';
        break;
      case 'stopped':
        variant = 'danger';
        break;
      default:
        variant = 'warning';
    }
    
    return (
      <Badge bg={variant} className="ms-2">
        <span className={`status-${status} server-status`}></span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading game servers...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Game Servers</h1>
        {isAdmin && (
          <Link to="/admin/servers/new" className="btn btn-success">
            <i className="fa fa-plus me-2"></i>Add Server
          </Link>
        )}
      </div>
      
      {servers.length === 0 ? (
        <div className="text-center mt-5">
          <p className="lead">No game servers found.</p>
          {isAdmin && (
            <Link to="/admin/servers/new" className="btn btn-success">
              Add Your First Server
            </Link>
          )}
        </div>
      ) : (
        <Row>
          {servers.map(server => (
            <Col key={server._id} md={4} className="mb-4">
              <Card className="server-card h-100">
                <Card.Header>
                  <h5>
                    {server.name}
                    {getStatusBadge(server.status)}
                  </h5>
                </Card.Header>
                <Card.Body className="d-flex flex-column">
                  <div className="text-center mb-3">
                    <img 
                      src={server.logo} 
                      alt={`${server.name} logo`} 
                      className="server-logo"
                      onError={(e) => {
                        // Prevent any further error events
                        e.target.onError = null;
                        
                        // Instead of loading another image which could fail again,
                        // replace with a text placeholder
                        e.target.style.display = "none";
                        const placeholder = document.createElement("div");
                        placeholder.className = "server-logo-placeholder";
                        placeholder.textContent = server.name.slice(0, 2).toUpperCase();
                        placeholder.style.backgroundColor = "#007bff";
                        placeholder.style.color = "white";
                        placeholder.style.width = "80px";
                        placeholder.style.height = "80px";
                        placeholder.style.borderRadius = "50%";
                        placeholder.style.display = "flex";
                        placeholder.style.alignItems = "center";
                        placeholder.style.justifyContent = "center";
                        placeholder.style.fontSize = "24px";
                        placeholder.style.margin = "0 auto";
                        e.target.parentNode.appendChild(placeholder);
                      }}
                    />
                  </div>
                  <Card.Text>
                    <strong>Connection:</strong> {server.connectionString}
                  </Card.Text>
                  <div className="mt-auto">
                    <Link to={`/servers/${server._id}`} className="btn btn-primary w-100">
                      View Details
                    </Link>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
};

export default ServerList;