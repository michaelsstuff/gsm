import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ComposeList from '../../../components/admin/ComposeList';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
jest.mock('axios');

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('ComposeList', () => {
  it('renders compose list and loads files', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ _id: '1', name: 'Test Compose', updatedAt: new Date() }] });
    renderWithRouter(<ComposeList />);
    expect(screen.getByText(/Loading compose files/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Test Compose/)).toBeInTheDocument());
  });

  it('shows error on failed fetch', async () => {
    axios.get.mockRejectedValueOnce(new Error('fail'));
    renderWithRouter(<ComposeList />);
    await waitFor(() => expect(screen.getByText(/Failed to load compose files/i)).toBeInTheDocument());
  });
});
