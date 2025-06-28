import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Button, Spinner, Alert, Modal, Form } from 'react-bootstrap';
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
  const isMounted = useRef(true); // Add ref to track mounted state  // State for logs functionality
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logLines, setLogLines] = useState(100);
  
  // State for backup output
  const [showBackupOutput, setShowBackupOutput] = useState(false);
  const [backupOutput, setBackupOutput] = useState('');
  const [backupInProgress, setBackupInProgress] = useState(false);

  // State for backup schedule management
  const [showBackupSchedule, setShowBackupSchedule] = useState(false);
  const [backupScheduleForm, setBackupScheduleForm] = useState({
    enabled: false,
    cronExpression: '0 0 * * *',
    retention: 5,
    notifyOnBackup: true
  });
  const [backupHistory, setBackupHistory] = useState([]);
  const [loadingBackupStatus, setLoadingBackupStatus] = useState(false);
  
  // State for Discord webhook management
  const [showDiscordWebhook, setShowDiscordWebhook] = useState(false);
  const [discordWebhookForm, setDiscordWebhookForm] = useState({
    enabled: false,
    url: '',
    notifyOnStart: true,
    notifyOnStop: true
  });
  const [loadingDiscordWebhook, setLoadingDiscordWebhook] = useState(false);

  // State for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false; // Set mounted ref to false when unmounting
    };
  }, []);

  useEffect(() => {
    const fetchServer = async () => {
      try {
        const res = await axios.get(`/api/servers/${id}`);
        if (isMounted.current) {
          setServer(res.data);
          setLoading(false);
          if (isAdmin) {
            loadBackupStatus();
            loadDiscordWebhook();
          }
        }
      } catch (err) {
        console.error('Error fetching server details:', err);
        if (isMounted.current) {
          setError('Failed to load server details. Please try again later.');
          setLoading(false);
        }
      }
    };

    fetchServer();
  }, [id, isAdmin]);

  useEffect(() => {
    // Refresh server status periodically
    if (server) {
      const interval = setInterval(() => {
        const checkStatus = async () => {
          try {
            if (!isMounted.current) {
              return; // Don't proceed if unmounted
            }
            const res = await axios.get(`/api/servers/status/${id}`);
            if (isMounted.current && res.data.status !== server.status) {
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

      return () => {
        clearInterval(interval); // Clear interval on cleanup
      };
    }
  }, [id, server, statusRefresh]);

  const handleCommand = async (command) => {
    try {
      setLoading(true);
      
      if (command === 'backup') {
        // Start backup with async handling
        setBackupInProgress(true);
        setBackupOutput('Starting backup process...\nThis may take several minutes for large servers.\nThe server will be stopped during backup and restarted automatically when complete.');
        setShowBackupOutput(true);
        
        // Initiate backup
        const response = await axios.post(`/api/admin/servers/${id}/command`, { command });
        
        if (response.data.jobStatus) {
          // Set up polling for backup status
          const pollBackupStatus = async () => {
            try {
              if (!isMounted.current) {
                return; // Don't proceed if unmounted
              }
              
              const statusRes = await axios.get(`/api/admin/servers/${id}/backup-job`);
              const { activeBackupJob, serverStatus } = statusRes.data;
              
              // Update server status if changed
              if (isMounted.current && serverStatus !== server.status) {
                setServer({
                  ...server,
                  status: serverStatus
                });
              }
              
              if (!activeBackupJob || !activeBackupJob.inProgress) {
                // Backup completed or failed
                if (isMounted.current) {
                  setBackupInProgress(false);
                  
                  if (activeBackupJob && activeBackupJob.status === 'failed') {
                    setBackupOutput(activeBackupJob.message || 'Backup failed with an unknown error');
                    setError(`Failed to backup server. ${activeBackupJob.message || 'Unknown error occurred'}`);
                  } else {
                    setBackupOutput(activeBackupJob?.message || 'Backup completed successfully');
                  }
                  
                  // Refresh backup status
                  await loadBackupStatus();
                }
                return;
              }
              
              // Update status message while backup is still in progress
              if (isMounted.current) {
                setBackupOutput(
                  activeBackupJob.message || 
                  'Backup in progress...\n\nThe server will remain stopped until the backup completes.\nThis process may take several minutes for large servers.'
                );
              
                // Continue polling only if still mounted
                if (isMounted.current) {
                  setTimeout(pollBackupStatus, 3000);
                }
              }
            } catch (err) {
              console.error('Error polling backup status:', err);
              if (isMounted.current) {
                setBackupInProgress(false);
                setBackupOutput(`Error checking backup status: ${err.message || 'Unknown error'}`);
              }
            }
          };
          
          // Start polling
          pollBackupStatus();
        } else {
          // Handle immediate completion (rare)
          if (isMounted.current) {
            setBackupOutput(response.data.result || 'Backup completed successfully');
            setBackupInProgress(false);
          }
        }
      } else {
        // Handle other commands (start, stop, restart) synchronously
        const response = await axios.post(`/api/admin/servers/${id}/command`, { command });
        
        // Trigger an immediate status refresh
        const res = await axios.get(`/api/servers/status/${id}`);
        if (isMounted.current) {
          setServer({
            ...server,
            status: res.data.status
          });
        }
      }
      
      if (isMounted.current) {
        setStatusRefresh(prev => prev + 1);
        setLoading(false);
      }
    } catch (err) {
      console.error(`Error running ${command} command:`, err);
      
      // Extract the most specific error message available
      let errorMessage = 'Unknown error occurred';
      
      if (err.response) {
        // Handle conflict (backup already in progress)
        if (err.response.status === 409 && command === 'backup') {
          const jobStatus = err.response.data?.jobStatus;
          if (isMounted.current) {
            setBackupInProgress(true);
            setBackupOutput(`A backup operation is already in progress.\nStarted at: ${new Date(jobStatus?.startedAt).toLocaleString()}\nStatus: ${jobStatus?.status}\nMessage: ${jobStatus?.message || 'In progress...'}`);
            setLoading(false);
          }
          return;
        }
        
        // The server responded with an error status
        if (err.response.data && err.response.data.message) {
          errorMessage = err.response.data.message;
        } else if (err.response.statusText) {
          errorMessage = err.response.statusText;
        }
      } else if (err.message) {
        // No response from server but there's a message property
        errorMessage = err.message;
      }
      
      if (isMounted.current) {
        setError(`Failed to ${command} server. ${errorMessage}`);
        setLoading(false);
        
        if (command === 'backup') {
          setBackupInProgress(false);
          setBackupOutput(`Backup failed: ${errorMessage}`);
        }
      }
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/admin/servers/${server._id}`);
      
      // Redirect to servers list after successful deletion
      window.location.href = '/servers';
    } catch (err) {
      console.error('Error deleting server:', err);
      if (isMounted.current) {
        setError('Failed to delete server. Please try again later.');
        setLoading(false);
      }
    }
  };

  const handleDeleteClick = () => {
    setDeleteConfirmationText('');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmationText === server.name) {
      setShowDeleteModal(false);
      handleDelete();
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
      if (isMounted.current) {
        setLogs(res.data.logs);
        setLoadingLogs(false);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      if (isMounted.current) {
        setError(`Failed to fetch logs: ${err.response?.data?.message || 'Unknown error'}`);
        setLoadingLogs(false);
      }
    }
  };

  // Handler for opening logs modal
  const handleShowLogs = () => {
    setShowLogs(true);
    fetchLogs();
  };

  // Handler for closing logs modal
  const handleCloseLogs = () => {
    setShowLogs(false);
  };

  // Handler for changing number of log lines
  const handleLogLinesChange = (e) => {
    setLogLines(Number(e.target.value));
  };

  // Handler for refreshing logs
  const handleRefreshLogs = () => {
    fetchLogs();
  };

  // Load backup status and history
  const loadBackupStatus = async () => {
    if (!isAdmin) return;
    
    try {
      setLoadingBackupStatus(true);
      const res = await axios.get(`/api/admin/servers/${id}/backup-status`);
      if (isMounted.current) {
        const { backupSchedule, backups } = res.data;
        
        setBackupScheduleForm({
          enabled: backupSchedule?.enabled || false,
          cronExpression: backupSchedule?.cronExpression || '0 0 * * *',
          retention: backupSchedule?.retention || 5,
          notifyOnBackup: backupSchedule?.notifyOnBackup !== false // default to true
        });
        setBackupHistory(backups);
        setLoadingBackupStatus(false);
      }
    } catch (err) {
      console.error('Error loading backup status:', err);
      if (isMounted.current) {
        setError('Failed to load backup status');
        setLoadingBackupStatus(false);
      }
    }
  };

  // Load Discord webhook settings
  const loadDiscordWebhook = async () => {
    if (!isAdmin) return;
    
    try {
      setLoadingDiscordWebhook(true);
      const res = await axios.get(`/api/admin/servers/${id}`);
      if (isMounted.current && res.data.discordWebhook) {
        setDiscordWebhookForm({
          enabled: res.data.discordWebhook.enabled || false,
          url: res.data.discordWebhook.url || '',
          notifyOnStart: res.data.discordWebhook.notifyOnStart !== false, // default to true
          notifyOnStop: res.data.discordWebhook.notifyOnStop !== false // default to true
        });
        setLoadingDiscordWebhook(false);
      }
    } catch (err) {
      console.error('Error loading Discord webhook settings:', err);
      if (isMounted.current) {
        setError('Failed to load Discord webhook settings');
        setLoadingDiscordWebhook(false);
      }
    }
  };

  const handleSaveBackupSchedule = async () => {
    try {
      setLoading(true);
      await axios.put(`/api/admin/servers/${id}/backup-schedule`, backupScheduleForm);
      if (isMounted.current) {
        await loadBackupStatus();
        setShowBackupSchedule(false);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error saving backup schedule:', err);
      if (isMounted.current) {
        setError(err.response?.data?.message || 'Failed to save backup schedule');
        setLoading(false);
      }
    }
  };

  // Save Discord webhook settings
  const handleSaveDiscordWebhook = async () => {
    try {
      setLoading(true);
      await axios.put(`/api/admin/servers/${id}/discord-webhook`, discordWebhookForm);
      if (isMounted.current) {
        // Refresh server data to get updated webhook settings
        const res = await axios.get(`/api/servers/${id}`);
        setServer(res.data);
        setShowDiscordWebhook(false);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error saving Discord webhook settings:', err);
      if (isMounted.current) {
        setError(err.response?.data?.message || 'Failed to save Discord webhook settings');
        setLoading(false);
      }
    }
  };

  const formatBackupDate = (date) => {
    return new Date(date).toLocaleString();
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
                  <Link 
                    to={`/admin/servers/${server._id}/files`} 
                    className="btn btn-secondary d-block"
                    disabled={loading}
                  >
                    Files
                  </Link>
                </div>
              </Card.Body>
            </Card>
          )}

          {isAdmin && (
            <Card className="mt-4">
              <Card.Header>Server Management</Card.Header>
              <Card.Body>
                <div className="d-grid gap-2">
                  <Link 
                    to={`/admin/servers/edit/${server._id}`} 
                    className="btn btn-secondary"
                  >
                    Edit Server
                  </Link>
                  <Button 
                    variant="info"
                    onClick={() => setShowBackupSchedule(true)}
                    disabled={loading}
                  >
                    Manage Backup Schedule
                  </Button>
                  <Button 
                    variant="primary"
                    onClick={() => setShowDiscordWebhook(true)}
                    disabled={loading}
                  >
                    Discord Notifications
                  </Button>
                  <Button 
                    variant="outline-danger"
                    onClick={handleDeleteClick}
                    disabled={loading}
                  >
                    Remove Server
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

      {/* Backup Schedule Modal */}
      <Modal show={showBackupSchedule} onHide={() => setShowBackupSchedule(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Backup Schedule - {server?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id="backup-enabled"
                label="Enable Scheduled Backups"
                checked={backupScheduleForm.enabled}
                onChange={e => setBackupScheduleForm({
                  ...backupScheduleForm,
                  enabled: e.target.checked
                })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Backup Schedule (Cron Expression)</Form.Label>
              <Form.Control
                type="text"
                value={backupScheduleForm.cronExpression}
                onChange={e => setBackupScheduleForm({
                  ...backupScheduleForm,
                  cronExpression: e.target.value
                })}
                placeholder="0 0 * * *"
              />
              <Form.Text className="text-muted">
                Format: minute hour day month weekday (e.g., "0 0 * * *" for daily at midnight)
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Retention (Number of backups to keep)</Form.Label>
              <Form.Control
                type="number"
                value={backupScheduleForm.retention}
                onChange={e => setBackupScheduleForm({
                  ...backupScheduleForm,
                  retention: parseInt(e.target.value, 10)
                })}
                min="1"
                max="30"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id="backup-notify"
                label="Send Discord notifications for backups"
                checked={backupScheduleForm.notifyOnBackup}
                onChange={e => setBackupScheduleForm({
                  ...backupScheduleForm,
                  notifyOnBackup: e.target.checked
                })}
                disabled={!backupScheduleForm.enabled}
              />
              <Form.Text className="text-muted">
                When enabled, Discord notifications will be sent for server stop, backup completion, and server restart during backup operations.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Common Schedules:</Form.Label>
              <div className="mb-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="me-2 mb-2"
                  onClick={() => setBackupScheduleForm({
                    ...backupScheduleForm,
                    cronExpression: '0 0 * * *'
                  })}
                >
                  Daily at midnight
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="me-2 mb-2"
                  onClick={() => setBackupScheduleForm({
                    ...backupScheduleForm,
                    cronExpression: '0 0 * * 0'
                  })}
                >
                  Weekly on Sunday
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="me-2 mb-2"
                  onClick={() => setBackupScheduleForm({
                    ...backupScheduleForm,
                    cronExpression: '0 0 1 * *'
                  })}
                >
                  Monthly
                </Button>
              </div>
              <Form.Text className="text-muted">
                Click a button to set a common schedule, or enter a custom cron expression.
              </Form.Text>
            </Form.Group>

            {backupHistory.length > 0 && (
              <>
                <h5 className="mt-4">Backup Status</h5>
                {server?.backupSchedule?.lastBackup && (
                  <p className="text-success mb-2">
                    Last successful backup: {formatBackupDate(server.backupSchedule.lastBackup)}
                  </p>
                )}
                {server?.backupSchedule?.lastError && (
                  <Alert variant="warning" className="mb-3">
                    <small>
                      Last error ({formatBackupDate(server.backupSchedule.lastError.date)}):
                      <br />
                      {server.backupSchedule.lastError.message}
                    </small>
                  </Alert>
                )}
                <h6>Backup History</h6>
                <div className="backup-history" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {backupHistory.map((backup, index) => (
                    <div key={index} className="backup-entry p-2 border-bottom">
                      <small className="text-muted">
                        {formatBackupDate(backup.date)}
                      </small>
                      <div>{backup.filename}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBackupSchedule(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveBackupSchedule} disabled={loading}>
            Save Schedule
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Discord Webhook Modal */}
      <Modal show={showDiscordWebhook} onHide={() => setShowDiscordWebhook(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Discord Notifications - {server?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDiscordWebhook ? (
            <div className="text-center">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p>Loading Discord settings...</p>
            </div>
          ) : (
            <Form>
              <Form.Group className="mb-3">
                <Form.Check
                  type="switch"
                  id="discord-enabled"
                  label="Enable Discord Notifications"
                  checked={discordWebhookForm.enabled}
                  onChange={e => setDiscordWebhookForm({
                    ...discordWebhookForm,
                    enabled: e.target.checked
                  })}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Discord Webhook URL</Form.Label>
                <Form.Control
                  type="text"
                  value={discordWebhookForm.url}
                  onChange={e => setDiscordWebhookForm({
                    ...discordWebhookForm,
                    url: e.target.value
                  })}
                  placeholder="https://discord.com/api/webhooks/..."
                  disabled={!discordWebhookForm.enabled}
                />
                <Form.Text className="text-muted">
                  Create a webhook in your Discord server's channel settings and paste the URL here.
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Notification Settings</Form.Label>
                <div>
                  <Form.Check
                    type="checkbox"
                    id="notify-start"
                    label="Send notification when server starts"
                    checked={discordWebhookForm.notifyOnStart}
                    onChange={e => setDiscordWebhookForm({
                      ...discordWebhookForm,
                      notifyOnStart: e.target.checked
                    })}
                    disabled={!discordWebhookForm.enabled}
                  />
                  <Form.Check
                    type="checkbox"
                    id="notify-stop"
                    label="Send notification when server stops"
                    checked={discordWebhookForm.notifyOnStop}
                    onChange={e => setDiscordWebhookForm({
                      ...discordWebhookForm,
                      notifyOnStop: e.target.checked
                    })}
                    disabled={!discordWebhookForm.enabled}
                  />
                </div>
              </Form.Group>

              <div className="mt-4">
                <Alert variant="info">
                  <i className="bi bi-info-circle me-2"></i>
                  Discord notifications will also be sent for restarts automatically. Backup notifications can be controlled separately in the backup schedule settings.
                </Alert>
              </div>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDiscordWebhook(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveDiscordWebhook} disabled={loading}>
            Save Settings
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">Confirm Server Removal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Warning:</strong> This action cannot be undone!
          </Alert>
          <p>
            You are about to remove <strong>{server?.name}</strong> from the server list. 
            This will not delete the Docker container, but it will remove all server configuration and backup schedules.
          </p>
          <p>
            To confirm, please type the server name <strong>{server?.name}</strong> below:
          </p>
          <Form.Control
            type="text"
            placeholder={`Type "${server?.name}" to confirm`}
            value={deleteConfirmationText}
            onChange={e => setDeleteConfirmationText(e.target.value)}
            className={deleteConfirmationText === server?.name ? 'is-valid' : ''}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteConfirm}
            disabled={deleteConfirmationText !== server?.name || loading}
          >
            Remove Server
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ServerDetail;