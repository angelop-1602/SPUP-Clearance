import { cn } from "@/utils/cn";

interface StatusBadgeProps {
  status: "Submitted" | "Cleared";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case "Submitted":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Cleared":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        getStatusStyles(),
        className
      )}
    >
      {status}
    </span>
  );
} 