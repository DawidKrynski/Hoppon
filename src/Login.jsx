import { useState, useMemo, useEffect } from "react";
import AnimatedInput from './components/AnimatedInput';
import "./Login.css";
import "./components/Button.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [waitingForVerification,setWaitingForVerification] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setError("");
  }, [username, password, email, confirmPassword, verificationCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Client submits form");

    if (!username || username.length < 3) {
      setError("Username must be at least 3 characters long");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    setWaitingForVerification(true);
    if (isRegistering) {
      
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Please enter a valid email address");
        return;
      }
      
      if (password !== confirmPassword) {
        setError("Passwords don't match");
        return;
      }


      try {
        const response = await fetch("http://localhost:3000/api/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();
        setWaitingForVerification(false);
        if (response.ok) {
          setShowVerification(true);
        } else {
          if (data.message.includes("already in use")) {
            setError("This email or username is already registered");
          } else {
            setError(data.message);
          }
        }
      } catch (err) {
        setWaitingForVerification(false);
        setError("Connection error. Please try again.");
      }
    } else {
      try {
        const response = await fetch("http://localhost:3000/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        setWaitingForVerification(false);
        if (response.ok) {
          localStorage.setItem("token", data.token);
          window.location.href = '/home';
        } else {
          if (data.message === "incorrect password") {
            setError("Wrong password");
          } else if (data.message === "username not found") {
            setError("Username not found");
          } else {
            setError(data.message);
          }
        }
      } catch (err) {
        setError("Connection error. Please try again.");
      }
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:3000/api/guest/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create guest account");
      }

      localStorage.setItem("token", data.token);
      window.location.href = "/home";
    } catch (err) {
      setError(err.message || "Failed to create guest account");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:3000/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        // redirect to homepage
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Connection error. Please try again");
    }
  };

  const toggleRegistration = () => {
    setIsRegistering(!isRegistering);
    setError("");
  };

  const emailError = useMemo(() => {
    if (!email) return "";
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    console.log("Email:", email, "IsValid:", isValid);
    return isValid ? "" : "Please enter a valid email address";
  }, [email]);

  if (showVerification) {
    return (
      <div className="login-box">
        <h1>Verify your email</h1>
        <form onSubmit={handleVerification}>
          <div className="input-field">
            <input
              type="text"
              placeholder="Enter verification code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              error={error}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit">Verify</button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-box">
      <h1> Welcome to Hoppon!</h1>
      <form onSubmit={handleSubmit}>
        {isRegistering && (
          <div className="input-field">
            <AnimatedInput
              type="email"
              placeholder="your email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              validate={(value) => {
                if (!value) return "Email is required";
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                  return "Please enter a valid email address";
                return "";
              }}
              error={error}
            />
            {error && error.includes("already") && (
              <span className="error-message">{error}</span>
            )}
          </div>
        )}
        <div className="input-field">
          <AnimatedInput
            type="text"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            validate={(value) => {
              if (!value) return "Username is required";
              if (value.length < 3)
                return "Username must be at least 3 characters long";
              return "";
            }}
          />
        </div>
        <div className="input-field">
          <AnimatedInput
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            validate={(value) => {
              if (!value) return "Password is required";
              if (value.length < 6)
                return "Password must be at least 6 characters long";
              if (!/[!@#$%^&*(),.?":{}|<>]/.test(value))
                return "Password must contain at least one special character";
              return "";
            }}
          />
        </div>
        {isRegistering && (
          <div className="input-field">
            <AnimatedInput
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              validate={(value) => {
                if (value !== password) return "Passwords don't match";
              }}
            />
          </div>
        )}

        <button type="submit" disabled={waitingForVerification}>
          {waitingForVerification ? (
            <div className="spinner-small"></div>
          ) : isRegistering ? (
            "Register"
          ) : (
            "Sign in"
          )}
        </button>
        <button type="button" onClick={toggleRegistration}>
          {isRegistering ? "Sign in instead" : "Register instead"}
        </button>
      </form>
      <div className="divider">or</div>
      <button
        type="button"
        onClick={handleGuestLogin}
        className="button-unique"
      >
        Continue as Guest
      </button>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
