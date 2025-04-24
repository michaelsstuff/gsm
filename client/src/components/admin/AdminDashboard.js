import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Button, Badge, Spinner, Alert, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const AdminDashboard = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const res = await axios.get('/api/admin/servers');
        setServers(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching servers:', err);
        setError('Failed to load game servers. Please try again later.');
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchServers();
    }
  }, [isAuthenticated]);

  const handleCommand = async (id, command) => {
    try {
      setLoading(true);
      await axios.post(`/api/admin/servers/${id}/command`, { command });
      
      // Refresh server list after command execution
      const res = await axios.get('/api/admin/servers');
      setServers(res.data);
      setLoading(false);
    } catch (err) {
      console.error(`Error running ${command} command:`, err);
      setError(`Failed to ${command} server. ${err.response?.data?.message || ''}`);
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove ${name} from the server list? This won't delete the Docker container.`)) {
      try {
        setLoading(true);
        await axios.delete(`/api/admin/servers/${id}`);
        
        // Remove from state
        setServers(servers.filter(server => server._id !== id));
        setLoading(false);
      } catch (err) {
        console.error('Error deleting server:', err);
        setError('Failed to delete server. Please try again later.');
        setLoading(false);
      }
    }
  };

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
      <Badge bg={variant}>
        <span className={`status-${status} server-status`}></span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading && servers.length === 0) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading game servers...</p>
      </Container>
    );
  }

  return (
    <Container>
      <Row className="mb-4 align-items-center">
        <Col>
          <h1>Admin Dashboard</h1>
        </Col>
        <Col xs="auto">
          <Link to="/admin/users" className="btn btn-outline-secondary me-2">
            Manage Users
          </Link>
          <Link to="/admin/servers/new" className="btn btn-primary">
            Add New Server
          </Link>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      <Card>
        <Card.Header as="h5">Game Servers</Card.Header>
        <Card.Body>
          {servers.length === 0 ? (
            <div className="text-center p-4">
              <p className="mb-3">No game servers added yet.</p>
              <Link to="/admin/servers/new" className="btn btn-primary">
                Add Your First Game Server
              </Link>
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Container</th>
                  <th>Status</th>
                  <th style={{ width: '280px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {servers.map(server => (
                  <tr key={server._id}>
                    <td>
                      <Link to={`/servers/${server._id}`}>
                        {server.name}
                      </Link>
                    </td>
                    <td>{server.containerName}</td>
                    <td>{getStatusBadge(server.status)}</td>
                    <td>
                      <div className="admin-actions">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleCommand(server._id, 'start')}
                          disabled={server.status === 'running' || loading}
                        >
                          Start
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleCommand(server._id, 'stop')}
                          disabled={server.status === 'stopped' || loading}
                        >
                          Stop
                        </Button>
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => handleCommand(server._id, 'restart')}
                          disabled={server.status === 'stopped' || loading}
                        >
                          Restart
                        </Button>
                        <Link
                          to={`/admin/servers/edit/${server._id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </Link>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(server._id, server.name)}
                          disabled={loading}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AdminDashboard;