import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Table, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import axios from 'axios';

const ModsBrowser = () => {
  const { id } = useParams();
  const [server, setServer] = useState(null);
  const [modFiles, setModFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState({});
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const fetchModFiles = async () => {
      try {
        const res = await axios.get(`/api/servers/${id}/mods`);
        setServer({
          name: res.data.serverName,
          modsDirectory: res.data.modsDirectory
        });
        setModFiles(res.data.files);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching mod files:', err);
        if (err.response?.status === 404) {
          setError('Mods directory not configured for this server or server not found.');
        } else {
          setError('Failed to load mod files. Please try again later.');
        }
        setLoading(false);
      }
    };

    fetchModFiles();
  }, [id]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedFiles = () => {
    return [...modFiles].sort((a, b) => {
      let aValue, bValue;
      
      if (sortField === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else if (sortField === 'modified') {
        aValue = new Date(a.modified);
        bValue = new Date(b.modified);
      } else if (sortField === 'size') {
        aValue = a.size;
        bValue = b.size;
      } else {
        return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <span className="text-muted">↕️</span>;
    }
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleDownload = async (file) => {
    setDownloading(prev => ({ ...prev, [file.path]: true }));
    
    try {
      const response = await axios.get(`/api/servers/${id}/mods/download/${file.path}`, {
        responseType: 'blob'
      });
      
      // Create blob link for download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Failed to download file. Please try again.');
    } finally {
      setDownloading(prev => ({ ...prev, [file.path]: false }));
    }
  };

  if (loading) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-3">Loading mod files...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-4">
        <Link to={`/servers/${id}`} className="btn btn-outline-secondary mb-3">
          &larr; Back to Server Details
        </Link>
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Link to={`/servers/${id}`} className="btn btn-outline-secondary mb-3">
        &larr; Back to Server Details
      </Link>
      
      <Card>
        <Card.Header as="h5">
          Mods - {server?.name}
          <Badge bg="secondary" className="ms-2">{modFiles.length} files</Badge>
        </Card.Header>
        <Card.Body>
          {modFiles.length === 0 ? (
            <Alert variant="warning">
              No mod files found in the configured directory.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table striped hover>
                <thead>
                  <tr>
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('name')}
                      className="text-nowrap"
                    >
                      File Name {getSortIcon('name')}
                    </th>
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('size')}
                      className="text-nowrap"
                    >
                      Size {getSortIcon('size')}
                    </th>
                    <th 
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => handleSort('modified')}
                      className="text-nowrap"
                    >
                      Modified {getSortIcon('modified')}
                    </th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedFiles().map((file, index) => (
                    <tr key={index}>
                      <td>
                        <span className="text-primary fw-bold">{file.name}</span>
                      </td>
                      <td>{formatFileSize(file.size)}</td>
                      <td>{formatDate(file.modified)}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleDownload(file)}
                          disabled={downloading[file.path]}
                        >
                          {downloading[file.path] ? (
                            <>
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                className="me-1"
                              />
                              Downloading...
                            </>
                          ) : (
                            'Download'
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          
          <Alert variant="light" className="mt-3">
            <small>
              <strong>Note:</strong> These files are read-only. You can download them but cannot upload, edit, or delete files through this interface.
            </small>
          </Alert>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ModsBrowser;
