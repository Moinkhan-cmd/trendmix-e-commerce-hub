/**
 * Mock Payment Service
 * Simulates payment processing for demonstration purposes.
 * ⚠️ This is NOT a real payment gateway - no actual transactions occur.
 */

import { Timestamp } from "firebase/firestore";
import type { PaymentInfo } from "./models";

export type PaymentMethod = "card" | "upi" | "cod" | "razorpay";

export type CardDetails = {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
};

export type UpiDetails = {
  upiId: string;
};

export type PaymentRequest = {
  method: PaymentMethod;
  amount: number;
  orderId?: string;
  cardDetails?: CardDetails;
  upiDetails?: UpiDetails;
};

export type PaymentResult = {
  success: boolean;
  transactionId?: string;
  message: string;
  paymentInfo: PaymentInfo;
};

// Test card numbers for different outcomes
export const TEST_CARDS = {
  SUCCESS: "4111111111111111", // Visa test card - always succeeds
  DECLINE: "4000000000000002", // Always declines
  INSUFFICIENT: "4000000000009995", // Insufficient funds
  EXPIRED: "4000000000000069", // Expired card
};

// Test UPI IDs for different outcomes
export const TEST_UPI = {
  SUCCESS: "success@upi",
  FAILURE: "failure@upi",
};

/**
 * Validates card number using Luhn algorithm (for demo purposes)
 */
export function validateCardNumber(cardNumber: string): { valid: boolean; error?: string } {
  const cleaned = cardNumber.replace(/\s/g, "");
  
  if (!/^\d{16}$/.test(cleaned)) {
    return { valid: false, error: "Card number must be 16 digits" };
  }

  // Luhn algorithm check (simplified for demo)
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  if (sum % 10 !== 0) {
    return { valid: false, error: "Invalid card number" };
  }

  return { valid: true };
}

/**
 * Validates expiry date (MM/YY format)
 */
export function validateExpiryDate(expiry: string): { valid: boolean; error?: string } {
  const match = expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
  
  if (!match) {
    return { valid: false, error: "Invalid format. Use MM/YY" };
  }

  const month = parseInt(match[1], 10);
  const year = parseInt("20" + match[2], 10);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { valid: false, error: "Card has expired" };
  }

  return { valid: true };
}

/**
 * Validates CVV (3 digits)
 */
export function validateCVV(cvv: string): { valid: boolean; error?: string } {
  if (!/^\d{3}$/.test(cvv)) {
    return { valid: false, error: "CVV must be 3 digits" };
  }
  return { valid: true };
}

/**
 * Validates UPI ID format
 */
export function validateUpiId(upiId: string): { valid: boolean; error?: string } {
  // Basic UPI ID validation: username@provider
  if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId)) {
    return { valid: false, error: "Invalid UPI ID format (e.g., user@upi)" };
  }
  return { valid: true };
}

/**
 * Generates a mock transaction ID
 */
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN${timestamp}${random}`;
}

/**
 * Simulates payment processing delay
 */
function simulateProcessingDelay(): Promise<void> {
  const delay = 2000 + Math.random() * 1500; // 2-3.5 seconds
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Determines payment outcome based on test card/UPI
 */
function determinePaymentOutcome(request: PaymentRequest): { 
  success: boolean; 
  message: string;
  declineReason?: string;
} {
  // Cash on Delivery always succeeds (payment pending)
  if (request.method === "cod") {
    return { success: true, message: "Cash on Delivery order confirmed" };
  }

  // Card payment outcomes
  if (request.method === "card" && request.cardDetails) {
    const cardNum = request.cardDetails.cardNumber.replace(/\s/g, "");
    
    switch (cardNum) {
      case TEST_CARDS.DECLINE:
        return { 
          success: false, 
          message: "Payment declined by bank",
          declineReason: "Card declined"
        };
      case TEST_CARDS.INSUFFICIENT:
        return { 
          success: false, 
          message: "Insufficient funds",
          declineReason: "Insufficient balance"
        };
      case TEST_CARDS.EXPIRED:
        return { 
          success: false, 
          message: "Card expired",
          declineReason: "Expired card"
        };
      default:
        // Default to success for other valid cards
        return { success: true, message: "Payment successful" };
    }
  }

  // UPI payment outcomes
  if (request.method === "upi" && request.upiDetails) {
    if (request.upiDetails.upiId.toLowerCase() === TEST_UPI.FAILURE) {
      return { 
        success: false, 
        message: "UPI payment failed",
        declineReason: "Transaction timeout"
      };
    }
    return { success: true, message: "UPI payment successful" };
  }

  return { success: true, message: "Payment processed" };
}

/**
 * Processes a mock payment
 * ⚠️ This is a simulation - no real money is charged
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  // Simulate network delay
  await simulateProcessingDelay();

  const outcome = determinePaymentOutcome(request);
  const transactionId = generateTransactionId();

  // Map our method types to PaymentInfo method types
  const methodMap: Record<PaymentMethod, PaymentInfo["method"]> = {
    card: "online",
    upi: "upi",
    cod: "cod",
  };

  if (outcome.success) {
    return {
      success: true,
      transactionId,
      message: outcome.message,
      paymentInfo: {
        method: methodMap[request.method],
        status: request.method === "cod" ? "pending" : "completed",
        transactionId: request.method !== "cod" ? transactionId : undefined,
        paidAt: request.method !== "cod" ? Timestamp.now() : undefined,
      },
    };
  }

  return {
    success: false,
    message: outcome.message,
    paymentInfo: {
      method: methodMap[request.method],
      status: "failed",
    },
  };
}

/**
 * Formats card number with spaces for display
 */
export function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(" ") : cleaned;
}

/**
 * Formats expiry date as MM/YY
 */
export function formatExpiryDate(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 4);
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + "/" + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Gets card type based on card number prefix
 */
export function getCardType(cardNumber: string): "visa" | "mastercard" | "amex" | "unknown" {
  const cleaned = cardNumber.replace(/\s/g, "");
  
  if (/^4/.test(cleaned)) return "visa";
  if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) return "mastercard";
  if (/^3[47]/.test(cleaned)) return "amex";
  
  return "unknown";
}
