import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface ColorVariant {
  name: string;
  value: string;
  hex?: string;
}

interface VariantSelectorProps {
  colors: ColorVariant[];
  selectedColor?: string;
  onSelect: (value: string) => void;
}

export function VariantSelector({ colors, selectedColor, onSelect }: VariantSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-2xl font-display text-content-primary">
        Excellent its Available in Multiple Colors!
      </h3>
      <p className="text-base text-content-secondary max-w-[500px]">
        You can get this exact design in the exact color you want choose an option below
      </p>

      <div className="flex flex-wrap gap-3 mt-6">
        {colors.map((color) => {
          const isSelected = selectedColor === color.value;

          return (
            <motion.button
              key={color.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(color.value)}
              className="relative min-w-[120px] h-12 px-4 rounded-lg
                       flex items-center justify-center
                       border-2 transition-all duration-200"
              style={{
                backgroundColor: color.hex || '#f3f4f6',
                borderColor: isSelected ? '#1f2937' : 'transparent',
                color: shouldUseWhiteText(color.hex) ? '#ffffff' : '#1f2937',
              }}
            >
              <span className="text-sm font-semibold">{color.name}</span>
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-content-primary rounded-full
                             flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// Helper to determine text color based on background
function shouldUseWhiteText(hex?: string): boolean {
  if (!hex) return false;

  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.5;
}
