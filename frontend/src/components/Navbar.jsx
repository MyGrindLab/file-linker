import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Bar>
      <Left>
        <Logo to="/">FileLinker</Logo>
        <NavLink to="/pricing">Pricing</NavLink>
      </Left>
      <Right>
        {user ? (
          <>
            {!user.is_paid && <UpgradeLink to="/pricing">Upgrade</UpgradeLink>}
            {user.is_paid && <Badge>Pro</Badge>}
            <NavLink to="/settings">Settings</NavLink>
            <TextButton onClick={handleLogout}>Logout</TextButton>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <RegisterLink to="/register">Register</RegisterLink>
          </>
        )}
      </Right>
    </Bar>
  );
}

const Bar = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 24px;
  min-height: 64px;
  background: rgba(255, 255, 255, 0.84);
  border-bottom: 1px solid rgba(24, 57, 42, 0.08);
  backdrop-filter: blur(14px);
  position: sticky;
  top: 0;
  z-index: 200;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const Logo = styled(Link)`
  font-size: 18px;
  font-weight: 700;
  color: #18392a;
  text-decoration: none;
  letter-spacing: -0.3px;
`;

const NavLink = styled(Link)`
  font-size: 14px;
  color: #496052;
  text-decoration: none;
  &:hover { color: #18392a; }
`;

const Badge = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #1f7a55;
  background: #edf7f1;
  border: 1px solid #caead8;
  border-radius: 999px;
  padding: 5px 10px;
`;

const RegisterLink = styled(Link)`
  font-size: 14px;
  color: #fff;
  background: linear-gradient(135deg, #1f7a55 0%, #2b9a67 100%);
  padding: 7px 16px;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 500;
  &:hover { filter: brightness(0.98); }
`;

const UpgradeLink = styled(Link)`
  font-size: 13px;
  color: #1f7a55;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid #1f7a55;
  padding: 5px 12px;
  border-radius: 999px;
  &:hover { background: #edf7f1; }
`;

const TextButton = styled.button`
  background: none;
  border: none;
  font-size: 14px;
  color: #6d7b74;
  cursor: pointer;
  padding: 0;
  &:hover { color: #18392a; }
`;
