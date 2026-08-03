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
            <NavLink to="/files">My files</NavLink>
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

/*
 * Narrow-viewport strategy: every group is allowed to wrap.
 *
 * The signed-in action group (Upgrade / My files / Settings / Logout) needs
 * ~254px on its own, which no amount of gap tightening fits next to the brand
 * on a 320px screen. Rather than hide destinations or bolt on a hamburger, the
 * bar wraps: the action group drops to a second row when it no longer fits
 * beside the brand, and wraps *within itself* as a last resort. Nothing is
 * removed, no accessible name changes, and the page never scrolls sideways.
 *
 * The `max-width: 420px` tweaks only tighten spacing so the (much narrower)
 * signed-out bar still fits on a single row down to 320px.
 */
const SMALL = '@media (max-width: 420px)';

const Bar = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 18px;
  padding: 10px 24px;
  min-height: 64px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.84);
  border-bottom: 1px solid rgba(24, 57, 42, 0.08);
  backdrop-filter: blur(14px);
  position: sticky;
  top: 0;
  z-index: 200;

  ${SMALL} {
    padding: 10px 16px;
    gap: 8px 12px;
  }
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 24px;

  ${SMALL} {
    gap: 8px 14px;
  }
`;

/* Grows into the space the brand leaves so its items stay right-aligned both
   on the shared row and on the row of its own it takes when wrapped. */
const Right = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 8px 16px;

  ${SMALL} {
    gap: 8px 12px;
  }
`;

const Logo = styled(Link)`
  font-size: 18px;
  font-weight: 700;
  color: #18392a;
  text-decoration: none;
  letter-spacing: -0.3px;

  ${SMALL} {
    font-size: 17px;
  }
`;

const NavLink = styled(Link)`
  font-size: 14px;
  color: #496052;
  text-decoration: none;
  white-space: nowrap;
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
  white-space: nowrap;
`;

const RegisterLink = styled(Link)`
  font-size: 14px;
  color: #fff;
  background: linear-gradient(135deg, #1f7a55 0%, #2b9a67 100%);
  padding: 7px 16px;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 500;
  white-space: nowrap;
  &:hover { filter: brightness(0.98); }

  ${SMALL} {
    padding: 7px 13px;
  }
`;

const UpgradeLink = styled(Link)`
  font-size: 13px;
  color: #1f7a55;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid #1f7a55;
  padding: 5px 12px;
  border-radius: 999px;
  white-space: nowrap;
  &:hover { background: #edf7f1; }

  ${SMALL} {
    padding: 5px 10px;
  }
`;

const TextButton = styled.button`
  background: none;
  border: none;
  font-size: 14px;
  color: #6d7b74;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
  &:hover { color: #18392a; }
`;
