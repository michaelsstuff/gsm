import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Button, Spinner, Alert, Modal } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const ServerDetail = () => {
  const { id } = useParams();
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusRefresh, setStatusRefresh] = useState(0);
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  // State for logs functionality
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logLines, setLogLines] = useState(100);

  // State for backup output
  const [showBackupOutput, setShowBackupOutput] = useState(false);
  const [backupOutput, setBackupOutput] = useState('');
  const [backupInProgress, setBackupInProgress] = useState(false);

  useEffect(() => {
    const fetchServer = async () => {
      try {
        const res = await axios.get(`/api/servers/${id}`);
        setServer(res.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching server details:', err);
        setError('Failed to load server details. Please try again later.');
        setLoading(false);
      }
    };

    fetchServer();
  }, [id]);

  useEffect(() => {
    // Refresh server status periodically
    if (server) {
      const interval = setInterval(() => {
        const checkStatus = async () => {
          try {
            const res = await axios.get(`/api/servers/status/${id}`);
            if (res.data.status !== server.status) {
              setServer({
                ...server,
                status: res.data.status
              });
            }
          } catch (err) {
            console.error('Error checking server status:', err);
          }
        };

        checkStatus();
      }, 10000); // Check every 10 seconds

      return () => clearInterval(interval);
    }
  }, [id, server, statusRefresh]);

  const handleCommand = async (command) => {
    try {
      setLoading(true);
      if (command === 'backup') {
        setBackupInProgress(true);
        setBackupOutput('Starting backup process...');
        setShowBackupOutput(true);
      }
      
      const response = await axios.post(`/api/admin/servers/${id}/command`, { command });
      
      if (command === 'backup') {
        setBackupOutput(response.data.result || 'Backup completed successfully');
      }
      
      // Trigger an immediate status refresh
      const res = await axios.get(`/api/servers/status/${id}`);
      setServer({
        ...server,
        status: res.data.status
      });
      
      setStatusRefresh(prev => prev + 1);
      setLoading(false);
      setBackupInProgress(false);
    } catch (err) {
      console.error(`Error running ${command} command:`, err);
      setError(`Failed to ${command} server. ${err.response?.data?.message || ''}`);
      setLoading(false);
      setBackupInProgress(false);
      if (command === 'backup') {
        setBackupOutput(`Backup failed: ${err.response?.data?.message || 'Unknown error'}`);
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

  // New function to fetch logs
  const fetchLogs = async () => {
    if (!isAdmin) return;
    
    try {
      setLoadingLogs(true);
      const res = await axios.get(`/api/admin/servers/${id}/logs?lines=${logLines}`);
      setLogs(res.data.logs);
      setLoadingLogs(false);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(`Failed to fetch logs: ${err.response?.data?.message || 'Unknown error'}`);
      setLoadingLogs(false);
    }
  };

  // Handle showing logs
  const handleShowLogs = () => {
    setShowLogs(true);
    fetchLogs();
  };

  // Handle closing logs modal
  const handleCloseLogs = () => {
    setShowLogs(false);
  };

  // Handle refreshing logs
  const handleRefreshLogs = () => {
    fetchLogs();
  };

  // Handle changing log lines count
  const handleLogLinesChange = (e) => {
    setLogLines(parseInt(e.target.value, 10));
  };

  if (loading && !server) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading server details...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">{error}</Alert>
        <div className="text-center mt-3">
          <Link to="/servers" className="btn btn-primary">
            Back to Server List
          </Link>
        </div>
      </Container>
    );
  }

  if (!server) {
    return (
      <Container className="mt-5">
        <Alert variant="warning">
          Server not found. It may have been removed or you have the wrong URL.
        </Alert>
        <div className="text-center mt-3">
          <Link to="/servers" className="btn btn-primary">
            Back to Server List
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Row className="mb-4">
        <Col>
          <Link to="/servers" className="btn btn-outline-secondary mb-3">
            &larr; Back to Server List
          </Link>
          <h1>
            {server.name} {getStatusBadge(server.status)}
          </h1>
        </Col>
      </Row>

      <Row>
        <Col md={4} className="mb-4">
          <Card>
            <Card.Body className="text-center">
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
                  placeholder.style.width = "100px";
                  placeholder.style.height = "100px";
                  placeholder.style.borderRadius = "50%";
                  placeholder.style.display = "flex";
                  placeholder.style.alignItems = "center";
                  placeholder.style.justifyContent = "center";
                  placeholder.style.fontSize = "32px";
                  placeholder.style.margin = "0 auto";
                  e.target.parentNode.appendChild(placeholder);
                }}
              />
            </Card.Body>
          </Card>

          {isAdmin && (
            <Card className="mt-4">
              <Card.Header>Admin Actions</Card.Header>
              <Card.Body>
                <div className="d-grid gap-2">
                  <Button 
                    variant="success" 
                    onClick={() => handleCommand('start')} 
                    disabled={loading || server.status === 'running'}
                  >
                    Start Server
                  </Button>
                  <Button 
                    variant="danger" 
                    onClick={() => handleCommand('stop')} 
                    disabled={loading || server.status === 'stopped'}
                  >
                    Stop Server
                  </Button>
                  <Button 
                    variant="warning" 
                    onClick={() => handleCommand('restart')} 
                    disabled={loading || server.status === 'stopped'}
                  >
                    Restart Server
                  </Button>
                  <Button 
                    variant="info" 
                    onClick={() => handleCommand('backup')}
                    disabled={loading}
                  >
                    Backup Server
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={handleShowLogs}
                    disabled={loading}
                  >
                    View Logs
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col md={8}>
          <Card className="mb-4">
            <Card.Header as="h5">Server Information</Card.Header>
            <Card.Body>
              <Row className="mb-3">
                <Col sm={4}><strong>Connection:</strong></Col>
                <Col sm={8}>{server.connectionString}</Col>
              </Row>
              
              {server.description && (
                <Row className="mb-3">
                  <Col sm={4}><strong>Description:</strong></Col>
                  <Col sm={8}>{server.description}</Col>
                </Row>
              )}
              
              {server.steamAppId && (
                <Row className="mb-3">
                  <Col sm={4}><strong>Steam:</strong></Col>
                  <Col sm={8}>
                    <a 
                      href={`https://store.steampowered.com/app/${server.steamAppId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Steam Store Page
                    </a>
                  </Col>
                </Row>
              )}
              
              {server.websiteUrl && (
                <Row className="mb-3">
                  <Col sm={4}><strong>Website:</strong></Col>
                  <Col sm={8}>
                    <a 
                      href={server.websiteUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Store
                    </a>
                  </Col>
                </Row>
              )}
              
              <Row>
                <Col sm={4}><strong>Status:</strong></Col>
                <Col sm={8}>{getStatusBadge(server.status)}</Col>
              </Row>
            </Card.Body>
          </Card>

          {isAdmin && (
            <div className="text-end">
              <Link 
                to={`/admin/servers/edit/${server._id}`} 
                className="btn btn-secondary"
              >
                Edit Server
              </Link>
            </div>
          )}
        </Col>
      </Row>

      {/* Logs Modal */}
      <Modal show={showLogs} onHide={handleCloseLogs} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Container Logs - {server?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingLogs ? (
            <div className="text-center">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p>Loading logs...</p>
            </div>
          ) : (
            <>
              <div className="mb-3 d-flex align-items-center">
                <label htmlFor="logLines" className="me-2">Show lines:</label>
                <select 
                  id="logLines" 
                  className="form-select w-auto" 
                  value={logLines}
                  onChange={handleLogLinesChange}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
                <Button 
                  variant="outline-secondary" 
                  className="ms-auto"
                  onClick={handleRefreshLogs}
                >
                  Refresh Logs
                </Button>
              </div>
              <pre 
                className="log-container p-3 bg-dark text-light" 
                style={{ 
                  maxHeight: '500px', 
                  overflowY: 'auto',
                  fontSize: '0.9rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {logs || 'No logs available'}
              </pre>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseLogs}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Backup Output Modal */}
      <Modal show={showBackupOutput} onHide={() => setShowBackupOutput(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Backup Status - {server?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <pre 
            className="log-container p-3 bg-dark text-light" 
            style={{ 
              maxHeight: '400px', 
              overflowY: 'auto',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {backupInProgress ? (
              <>
                {backupOutput}
                {'\n'}
                <Spinner 
                  animation="border" 
                  size="sm" 
                  className="ms-2"
                  style={{ verticalAlign: 'middle' }}
                />
              </>
            ) : (
              backupOutput
            )}
          </pre>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBackupOutput(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ServerDetail;