import React, { useState, useEffect } from'react';

/**
 * Professional AmountInput Component
 * Formats numbers with commas as user types (e.g., 300,000)
 * Prevents non-numeric input and helps avoid zero-count errors.
 */
const AmountInput = ({ value, onChange, placeholder, className, name, showCurrency = true, allowDecimal = false, ...props }) => {
 const [displayValue, setDisplayValue] = useState('');

 // Format number with commas: 1234567 ->"1,234,567" or 1234.56 ->"1,234.56"
 const formatNumber = (num) => {
 if (!num && num !== 0) return'';
 const str = num.toString();
 if (allowDecimal && str.includes('.')) {
 const [integerPart, decimalPart] = str.split('.');
 const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 return `${formattedInteger}.${decimalPart}`;
 }
 return str.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
 };

 // Keep display value in sync with external value props
 useEffect(() => {
 if (value !== undefined && value !== null) {
 const cleanValue = value.toString().replace(/,/g,'');
 setDisplayValue(formatNumber(cleanValue));
 }
 }, [value, allowDecimal]);

 const handleChange = (e) => {
 let rawValue = e.target.value;
        
 if (allowDecimal) {
 // Allow digits and only one decimal point
 rawValue = rawValue.replace(/[^0-9.]/g, '');
 const parts = rawValue.split('.');
 if (parts.length > 2) {
 rawValue = `${parts[0]}.${parts.slice(1).join('')}`;
 }
 } else {
 // Remove everything except digits
 rawValue = rawValue.replace(/\D/g,'');
 }
        
 // Prevent extremely large numbers to avoid overflow issues (optional limit)
 if (rawValue.length > 15) return;

 // Update internal display state
 setDisplayValue(formatNumber(rawValue));

 // Call external onChange with pure numeric string or number
 if (onChange) {
 const syntheticEvent = {
 target: {
 name,
 value: rawValue,
 type:'text'
 }
 };
 onChange(syntheticEvent);
 }
 };

 return (
 <div className="relative w-full">
 <input
 {...props}
 type="text"
 name={name}
 value={displayValue}
 onChange={handleChange}
 placeholder={placeholder}
 className={`${className} font-mono`} // Monospace font helps align digits
 inputMode={allowDecimal ? "decimal" : "numeric"} // Forces numeric/decimal keyboard on mobile
 />
 {showCurrency && displayValue && (
        <span className="absolute right-12 top-1/2 -translate-y-1/2 text-[8px] font-black opacity-30 pointer-events-none capitalize">
            UZS
        </span>
    )}
 </div>
 );
};

export default AmountInput;
