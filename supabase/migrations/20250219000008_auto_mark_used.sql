-- Create a function to automatically mark a license as used when a hardware_id is set
CREATE OR REPLACE FUNCTION public.handle_license_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- If hardware_id is being set (was null, now not null)
  IF OLD.hardware_id IS NULL AND NEW.hardware_id IS NOT NULL THEN
    -- Automatically set status to 'used'
    NEW.status := 'used';
    
    -- Set activated_at if not provided
    IF NEW.activated_at IS NULL THEN
      NEW.activated_at := NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_license_activation ON public.licenses;
CREATE TRIGGER on_license_activation
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_license_activation();

-- Optional: Run a one-time update to fix any existing licenses that have hardware_id but are not marked as used
UPDATE public.licenses
SET status = 'used', activated_at = COALESCE(activated_at, created_at)
WHERE hardware_id IS NOT NULL AND status = 'active';
