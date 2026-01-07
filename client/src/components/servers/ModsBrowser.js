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
  const [downloadingBulk, setDownloadingBulk] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
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

  const handleDownload = (file) => {
    // Trigger native browser download by creating a link and clicking it
    // This allows the browser to show real-time download progress
    const link = document.createElement('a');
    link.href = `/api/servers/${id}/mods/download/${file.path}`;
    link.setAttribute('download', file.name);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkDownload = async (downloadAll = false) => {
    setDownloadingBulk(true);
    
    try {
      const payload = downloadAll 
        ? { downloadAll: true }
        : { files: selectedFiles };
      
      const response = await axios.post(`/api/servers/${id}/mods/download-bulk`, payload, {
        responseType: 'blob'
      });
      
      // Create blob link for download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = downloadAll 
        ? `${server?.name.replace(/[^a-zA-Z0-9]/g, '_')}_all_mods.zip`
        : `${server?.name.replace(/[^a-zA-Z0-9]/g, '_')}_selected_mods.zip`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      if (!downloadAll) {
        setSelectedFiles([]);
      }
    } catch (err) {
      console.error('Error downloading files:', err);
      alert('Failed to download files. Please try again.');
    } finally {
      setDownloadingBulk(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedFiles(modFiles.map(file => file.path));
    } else {
      setSelectedFiles([]);
    }
  };

  const handleSelectFile = (filePath) => {
    setSelectedFiles(prev => {
      if (prev.includes(filePath)) {
        return prev.filter(p => p !== filePath);
      } else {
        return [...prev, filePath];
      }
    });
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
          <div className="float-end">
            <Button
              variant="success"
              size="sm"
              onClick={() => handleBulkDownload(true)}
              disabled={downloadingBulk || modFiles.length === 0}
              className="me-2"
            >
              {downloadingBulk ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-1"
                  />
                  Preparing...
                </>
              ) : (
                '📦 Download All'
              )}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleBulkDownload(false)}
              disabled={downloadingBulk || selectedFiles.length === 0}
            >
              📥 Download Selected ({selectedFiles.length})
            </Button>
          </div>
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
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.length === modFiles.length && modFiles.length > 0}
                        onChange={handleSelectAll}
                        className="form-check-input"
                      />
                    </th>
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
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.path)}
                          onChange={() => handleSelectFile(file.path)}
                          className="form-check-input"
                        />
                      </td>
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
                        >
                          Download
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
