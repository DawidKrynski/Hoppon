import { useState, useEffect } from "react";
import "./AnimatedInput.css";

export default function AnimatedInput({
  type,
  placeholder,
  value,
  onChange,
  validate,
  isLoading = false,
}) {
  const [isTouched, setIsTouched] = useState(false);
  const [validationState, setValidationState] = useState("idle");

  const error = isTouched ? validate(value)  : "";

  useEffect(() => {
    if (isTouched) {
      setValidationState("loading");
      setTimeout(() => {
        setValidationState(!error ? "valid" : "invalid");
      }, 200);
    }
  }, [error, isTouched]);

  const handleChange = (e) => {
    onChange(e);
    if (validate && isTouched) {
      setValidationState("loading");
      setTimeout(() => {
        setValidationState(!validate(e.target.value) ? "valid" : "invalid");
      }, 200);
    }
  };

  const handleBlur = () => {
    setIsTouched(true);
    if (validate) {
      setValidationState("loading");
      setTimeout(() => {
        setValidationState(!validate(value) ? "valid" : "invalid");
      }, 200);
    }
  };


  const inputClassName = `animated-input ${
    validationState === "valid"
      ? "valid"
      : validationState === "invalid"
      ? "invalid"
      : ""
  }`;

  return (
    <div className="input-wrapper">
      <div className={inputClassName}>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <div className="indicator">
          {validationState === "loading" && <div className="spinner"></div>}
          {validationState === "valid" && <div className="checkmark">✓</div>}
          {validationState === "invalid" && <div className="cross">×</div>}
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
