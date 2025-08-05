import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from '../Dashboard';

test('admin sees CTI Management tab', () => {
  const adminUser = { role: 'admin', username: 'admin' };
  render(<Dashboard user={adminUser} onLogout={() => {}} />);
  expect(screen.getByText('CTI Management')).toBeInTheDocument();
});

test('support engineer sees CTI Records tab', () => {
  const supportUser = { role: 'support_engineer', username: 'support1' };
  render(<Dashboard user={supportUser} onLogout={() => {}} />);
  expect(screen.getByText('CTI Records')).toBeInTheDocument();
  expect(screen.queryByText('CTI Management')).not.toBeInTheDocument();
});
