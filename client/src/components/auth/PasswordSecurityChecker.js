import React, { useState, useEffect } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';

const PasswordSecurityChecker = ({ password, onSecurityCheck, disabled = false }) => {
  const [securityStatus, setSecurityStatus] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedPassword, setLastCheckedPassword] = useState('');

  useEffect(() => {
    // Don't check empty passwords or if disabled
    if (!password || password.length < 6 || disabled) {
      setSecurityStatus(null);
      if (onSecurityCheck) {
        onSecurityCheck({ isSecure: true, message: '', shouldBlock: false });
      }
      return;
    }

    // Don't re-check the same password
    if (password === lastCheckedPassword) {
      return;
    }

    // Debounce password checking
    const timeoutId = setTimeout(async () => {
      await checkPasswordSecurity(password);
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [password, disabled, lastCheckedPassword]);

  const checkPasswordSecurity = async (passwordToCheck) => {
    if (isChecking) return;

    setIsChecking(true);
    setLastCheckedPassword(passwordToCheck);

    try {
      const response = await axios.post('/api/auth/check-password', {
        password: passwordToCheck
      });

      const { isPwned, count, message, shouldBlock, error } = response.data;

      const status = {
        isPwned,
        count,
        message,
        shouldBlock,
        error,
        isSecure: !shouldBlock
      };

      setSecurityStatus(status);

      // Notify parent component
      if (onSecurityCheck) {
        onSecurityCheck(status);
      }

    } catch (error) {
      console.error('Error checking password security:', error);
      const errorStatus = {
        isPwned: false,
        count: 0,
        message: 'Password security check unavailable',
        shouldBlock: false,
        error: 'Service temporarily unavailable',
        isSecure: true // Don't block user if service is down
      };

      setSecurityStatus(errorStatus);

      if (onSecurityCheck) {
        onSecurityCheck(errorStatus);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const getAlertVariant = () => {
    if (!securityStatus || securityStatus.error) return 'warning';
    if (securityStatus.shouldBlock) return 'danger';
    if (securityStatus.isPwned) return 'warning';
    return 'success';
  };

  const getAlertIcon = () => {
    if (isChecking) return '🔍';
    if (!securityStatus || securityStatus.error) return '⚠️';
    if (securityStatus.shouldBlock) return '🚫';
    if (securityStatus.isPwned) return '⚠️';
    return '✅';
  };

  const shouldShowAlert = () => {
    return password && password.length >= 6 && !disabled && 
           (securityStatus || isChecking);
  };

  if (!shouldShowAlert()) {
    return null;
  }

  return (
    <div className="mt-2">
      {isChecking && (
        <Alert variant="info" className="d-flex align-items-center">
          <Spinner animation="border" size="sm" className="me-2" />
          Checking password security...
        </Alert>
      )}

      {!isChecking && securityStatus && (
        <Alert variant={getAlertVariant()} className="d-flex align-items-start">
          <span className="me-2" style={{ fontSize: '1.2em' }}>
            {getAlertIcon()}
          </span>
          <div>
            <div>{securityStatus.message}</div>
            {securityStatus.isPwned && !securityStatus.shouldBlock && (
              <small className="text-muted">
                You can still use this password, but we recommend choosing a more secure one.
              </small>
            )}
            {securityStatus.shouldBlock && (
              <small>
                <strong>Please choose a different password to continue.</strong>
              </small>
            )}
            {securityStatus.error && (
              <small className="text-muted">
                Password security check is temporarily unavailable, but you can still proceed.
              </small>
            )}
          </div>
        </Alert>
      )}
    </div>
  );
};

export default PasswordSecurityChecker;