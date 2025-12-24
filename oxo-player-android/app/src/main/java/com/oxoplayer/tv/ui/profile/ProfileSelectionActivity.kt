package com.oxoplayer.tv.ui.profile

import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.ProfileManager
import com.oxoplayer.tv.data.WatchProgressManager
import com.oxoplayer.tv.data.models.Profile
import com.oxoplayer.tv.ui.home.HomeActivity

/**
 * Profile Selection Activity - Netflix-style profile picker
 * Shows up to 4 profiles + "Add Profile" button
 * Supports PIN protection for profiles
 */
class ProfileSelectionActivity : AppCompatActivity() {

    private lateinit var profilesContainer: LinearLayout
    private lateinit var createProfileOverlay: FrameLayout
    private lateinit var editProfilesButton: Button
    
    // Create/Edit profile dialog elements
    private lateinit var dialogTitle: TextView
    private lateinit var profileNameInput: EditText
    private lateinit var kidsProfileCheckbox: CheckBox
    private lateinit var pinEnabledCheckbox: CheckBox
    private lateinit var pinCodeInput: EditText
    private lateinit var avatarSelectionContainer: LinearLayout
    private lateinit var saveButton: Button
    private lateinit var cancelButton: Button
    
    // PIN input dialog elements
    private lateinit var pinInputOverlay: FrameLayout
    private lateinit var pinDots: List<View>
    private lateinit var pinErrorText: TextView
    private var enteredPin = StringBuilder()
    private var profileToUnlock: Profile? = null
    
    private var selectedAvatarIndex = 0
    private var editingProfile: Profile? = null
    private var isEditMode = false
    
    // Avatar resource IDs
    private val avatarResources = listOf(
        R.drawable.avatar_1,
        R.drawable.avatar_2,
        R.drawable.avatar_3,
        R.drawable.avatar_4,
        R.drawable.avatar_5,
        R.drawable.avatar_6,
        R.drawable.avatar_7,
        R.drawable.avatar_8
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile_selection)
        
        initViews()
        setupAvatarSelection()
        loadProfiles()
    }
    
    private fun initViews() {
        profilesContainer = findViewById(R.id.profilesContainer)
        createProfileOverlay = findViewById(R.id.createProfileOverlay)
        editProfilesButton = findViewById(R.id.editProfilesButton)
        
        // Dialog views
        dialogTitle = findViewById(R.id.dialogTitle)
        profileNameInput = findViewById(R.id.profileNameInput)
        kidsProfileCheckbox = findViewById(R.id.kidsProfileCheckbox)
        pinEnabledCheckbox = findViewById(R.id.pinEnabledCheckbox)
        pinCodeInput = findViewById(R.id.pinCodeInput)
        avatarSelectionContainer = findViewById(R.id.avatarSelectionContainer)
        saveButton = findViewById(R.id.saveButton)
        cancelButton = findViewById(R.id.cancelButton)
        
        // PIN input overlay views
        pinInputOverlay = findViewById(R.id.pinInputOverlay)
        pinDots = listOf(
            findViewById(R.id.pinDot1),
            findViewById(R.id.pinDot2),
            findViewById(R.id.pinDot3),
            findViewById(R.id.pinDot4)
        )
        pinErrorText = findViewById(R.id.pinErrorText)
        
        // PIN checkbox toggle
        pinEnabledCheckbox.setOnCheckedChangeListener { _, isChecked ->
            pinCodeInput.visibility = if (isChecked) View.VISIBLE else View.GONE
            if (!isChecked) {
                pinCodeInput.setText("")
            }
        }
        
        // Setup PIN keypad
        setupPinKeypad()
        
        // Button listeners
        cancelButton.setOnClickListener {
            hideCreateProfileDialog()
        }
        
        saveButton.setOnClickListener {
            saveProfile()
        }
        
        editProfilesButton.setOnClickListener {
            toggleEditMode()
        }
    }
    
    private fun setupPinKeypad() {
        // Find TextViews within the pinInputOverlay container
        val key1 = pinInputOverlay.findViewById<TextView>(R.id.pinKey1)
        val key2 = pinInputOverlay.findViewById<TextView>(R.id.pinKey2)
        val key3 = pinInputOverlay.findViewById<TextView>(R.id.pinKey3)
        val key4 = pinInputOverlay.findViewById<TextView>(R.id.pinKey4)
        val key5 = pinInputOverlay.findViewById<TextView>(R.id.pinKey5)
        val key6 = pinInputOverlay.findViewById<TextView>(R.id.pinKey6)
        val key7 = pinInputOverlay.findViewById<TextView>(R.id.pinKey7)
        val key8 = pinInputOverlay.findViewById<TextView>(R.id.pinKey8)
        val key9 = pinInputOverlay.findViewById<TextView>(R.id.pinKey9)
        val key0 = pinInputOverlay.findViewById<TextView>(R.id.pinKey0)
        val keyDelete = pinInputOverlay.findViewById<TextView>(R.id.pinKeyDelete)
        val keyCancel = pinInputOverlay.findViewById<TextView>(R.id.pinKeyCancel)
        
        // Setup click listeners for number keys
        val numberKeys = listOf(
            key1 to "1", key2 to "2", key3 to "3",
            key4 to "4", key5 to "5", key6 to "6",
            key7 to "7", key8 to "8", key9 to "9",
            key0 to "0"
        )
        
        numberKeys.forEach { (textView, digit) ->
            textView?.setOnClickListener {
                if (enteredPin.length < 4) {
                    enteredPin.append(digit)
                    updatePinDots()
                    pinErrorText.visibility = View.GONE
                    
                    // Auto-validate when 4 digits entered
                    if (enteredPin.length == 4) {
                        validatePin()
                    }
                }
            }
        }
        
        // Delete key
        keyDelete?.setOnClickListener {
            if (enteredPin.isNotEmpty()) {
                enteredPin.deleteCharAt(enteredPin.length - 1)
                updatePinDots()
            }
        }
        
        // Cancel key
        keyCancel?.setOnClickListener {
            hidePinInputDialog()
        }
    }
    
    private fun updatePinDots() {
        pinDots.forEachIndexed { index, dot ->
            val backgroundRes = if (index < enteredPin.length) {
                R.drawable.pin_dot_filled
            } else {
                R.drawable.pin_dot_empty
            }
            dot.setBackgroundResource(backgroundRes)
        }
    }
    
    private fun validatePin() {
        val profile = profileToUnlock ?: return
        
        if (enteredPin.toString() == profile.pin) {
            // PIN correct - proceed to home
            hidePinInputDialog()
            selectProfileAndNavigate(profile)
        } else {
            // PIN incorrect - show error and clear
            pinErrorText.visibility = View.VISIBLE
            enteredPin.clear()
            updatePinDots()
            
            // Shake animation for error feedback
            pinInputOverlay.findViewById<View>(R.id.pinDotsContainer)?.let { container ->
                container.animate()
                    .translationX(20f)
                    .setDuration(50)
                    .withEndAction {
                        container.animate()
                            .translationX(-20f)
                            .setDuration(50)
                            .withEndAction {
                                container.animate()
                                    .translationX(0f)
                                    .setDuration(50)
                                    .start()
                            }
                            .start()
                    }
                    .start()
            }
        }
    }
    
    private fun showPinInputDialog(profile: Profile) {
        profileToUnlock = profile
        enteredPin.clear()
        updatePinDots()
        pinErrorText.visibility = View.GONE
        
        // Update dialog title with profile name
        pinInputOverlay.findViewById<TextView>(R.id.pinDialogSubtitle)?.text = 
            "Profil: ${profile.name}"
        
        // Disable focus on background elements
        setBackgroundFocusable(false)
        
        pinInputOverlay.visibility = View.VISIBLE
        
        // Focus the first pin key
        pinInputOverlay.findViewById<TextView>(R.id.pinKey1)?.requestFocus()
    }
    
    private fun hidePinInputDialog() {
        pinInputOverlay.visibility = View.GONE
        profileToUnlock = null
        enteredPin.clear()
        
        // Re-enable focus on background elements
        setBackgroundFocusable(true)
        
        // Return focus to profiles
        if (profilesContainer.childCount > 0) {
            profilesContainer.getChildAt(0)?.requestFocus()
        }
    }
    
    private fun setupAvatarSelection() {
        avatarSelectionContainer.removeAllViews()
        
        for ((index, avatarRes) in avatarResources.withIndex()) {
            val avatarView = ImageView(this).apply {
                layoutParams = LinearLayout.LayoutParams(80, 80).apply {
                    marginEnd = 12
                }
                setImageResource(avatarRes)
                scaleType = ImageView.ScaleType.CENTER_CROP
                
                // Selection border
                if (index == selectedAvatarIndex) {
                    setBackgroundResource(R.drawable.avatar_selected_border)
                    setPadding(4, 4, 4, 4)
                } else {
                    setBackgroundResource(R.drawable.avatar_focus_border)
                    setPadding(4, 4, 4, 4)
                }
                
                setOnClickListener {
                    selectAvatar(index)
                }
                
                // Make focusable for TV navigation with visible focus change
                isFocusable = true
                isClickable = true
                
                // Focus change listener for TV remote navigation
                setOnFocusChangeListener { v, hasFocus ->
                    if (hasFocus) {
                        v.scaleX = 1.15f
                        v.scaleY = 1.15f
                        v.elevation = 8f
                    } else {
                        v.scaleX = 1.0f
                        v.scaleY = 1.0f
                        v.elevation = 0f
                    }
                }
            }
            avatarSelectionContainer.addView(avatarView)
        }
    }
    
    private fun selectAvatar(index: Int) {
        selectedAvatarIndex = index
        setupAvatarSelection() // Refresh to show selection
    }
    
    private fun loadProfiles() {
        profilesContainer.removeAllViews()
        
        val profiles = ProfileManager.getProfiles()
        
        // Show edit button if there are profiles
        editProfilesButton.visibility = if (profiles.isNotEmpty()) View.VISIBLE else View.GONE
        
        // Add existing profiles
        for (profile in profiles) {
            addProfileView(profile)
        }
        
        // Add "Add Profile" button if under limit
        if (ProfileManager.canAddProfile()) {
            addAddProfileButton()
        }
    }
    
    private fun addProfileView(profile: Profile) {
        val view = LayoutInflater.from(this).inflate(R.layout.item_profile, profilesContainer, false)
        
        val avatarImage = view.findViewById<ImageView>(R.id.profileAvatar)
        val nameText = view.findViewById<TextView>(R.id.profileName)
        val kidsBadge = view.findViewById<TextView>(R.id.kidsBadge)
        val lockIcon = view.findViewById<ImageView>(R.id.lockIcon)
        val editIcon = view.findViewById<ImageView>(R.id.editIcon)
        
        // Set avatar
        val avatarRes = avatarResources.getOrElse(profile.avatarIndex) { avatarResources[0] }
        avatarImage.setImageResource(avatarRes)
        
        // Set name
        nameText.text = profile.name
        
        // Show kids badge
        kidsBadge.visibility = if (profile.isKidsProfile) View.VISIBLE else View.GONE
        
        // Show lock icon if PIN is set
        lockIcon.visibility = if (profile.hasPin && !isEditMode) View.VISIBLE else View.GONE
        
        // Show edit icon in edit mode
        editIcon.visibility = if (isEditMode) View.VISIBLE else View.GONE
        
        // Click listener
        view.setOnClickListener {
            if (isEditMode) {
                showEditProfileDialog(profile)
            } else {
                selectProfile(profile)
            }
        }
        
        // Long click to edit
        view.setOnLongClickListener {
            showEditProfileDialog(profile)
            true
        }
        
        // Focus handling for TV - visible border and scale effect
        view.isFocusable = true
        view.setOnFocusChangeListener { v, hasFocus ->
            if (hasFocus) {
                v.alpha = 1.0f
                v.scaleX = 1.15f
                v.scaleY = 1.15f
                v.elevation = 12f
                // Update profile name color to show selection
                v.findViewById<TextView>(R.id.profileName)?.setTextColor(
                    resources.getColor(android.R.color.white, theme)
                )
            } else {
                v.alpha = 0.9f
                v.scaleX = 1.0f
                v.scaleY = 1.0f
                v.elevation = 0f
                v.findViewById<TextView>(R.id.profileName)?.setTextColor(
                    resources.getColor(R.color.light_gray, theme)
                )
            }
        }
        
        profilesContainer.addView(view)
    }
    
    private fun addAddProfileButton() {
        val view = LayoutInflater.from(this).inflate(R.layout.item_add_profile, profilesContainer, false)
        view.setBackgroundResource(R.drawable.profile_focus_border)
        
        view.setOnClickListener {
            showCreateProfileDialog()
        }
        
        // Focus handling for TV - visible border and scale effect
        view.isFocusable = true
        view.setOnFocusChangeListener { v, hasFocus ->
            if (hasFocus) {
                v.alpha = 1.0f
                v.scaleX = 1.15f
                v.scaleY = 1.15f
                v.elevation = 12f
            } else {
                v.alpha = 0.7f
                v.scaleX = 1.0f
                v.scaleY = 1.0f
                v.elevation = 0f
            }
        }
        
        profilesContainer.addView(view)
    }
    
    private fun selectProfile(profile: Profile) {
        // Check if profile has PIN
        if (profile.hasPin) {
            showPinInputDialog(profile)
        } else {
            selectProfileAndNavigate(profile)
        }
    }
    
    private fun selectProfileAndNavigate(profile: Profile) {
        // Select this profile
        ProfileManager.selectProfile(profile)
        
        // Navigate to home
        val intent = Intent(this, HomeActivity::class.java)
        startActivity(intent)
        finish()
    }
    
    private fun showCreateProfileDialog() {
        editingProfile = null
        dialogTitle.text = "Créer un profil"
        profileNameInput.setText("")
        kidsProfileCheckbox.isChecked = false
        pinEnabledCheckbox.isChecked = false
        pinCodeInput.setText("")
        pinCodeInput.visibility = View.GONE
        selectedAvatarIndex = ProfileManager.getProfileCount() % avatarResources.size
        setupAvatarSelection()
        
        // Disable focus on background elements
        setBackgroundFocusable(false)
        
        createProfileOverlay.visibility = View.VISIBLE
        
        // Give focus to first avatar in dialog
        avatarSelectionContainer.getChildAt(0)?.requestFocus()
    }
    
    private fun showEditProfileDialog(profile: Profile) {
        editingProfile = profile
        dialogTitle.text = "Modifier le profil"
        profileNameInput.setText(profile.name)
        kidsProfileCheckbox.isChecked = profile.isKidsProfile
        pinEnabledCheckbox.isChecked = profile.hasPin
        pinCodeInput.setText(profile.pin ?: "")
        pinCodeInput.visibility = if (profile.hasPin) View.VISIBLE else View.GONE
        selectedAvatarIndex = profile.avatarIndex
        setupAvatarSelection()
        
        // Disable focus on background elements
        setBackgroundFocusable(false)
        
        createProfileOverlay.visibility = View.VISIBLE
        
        // Give focus to first avatar in dialog
        avatarSelectionContainer.getChildAt(0)?.requestFocus()
    }
    
    private fun hideCreateProfileDialog() {
        createProfileOverlay.visibility = View.GONE
        editingProfile = null
        
        // Re-enable focus on background elements
        setBackgroundFocusable(true)
        
        // Return focus to profiles
        if (profilesContainer.childCount > 0) {
            profilesContainer.getChildAt(0)?.requestFocus()
        }
    }
    
    /**
     * Enable/disable focusability of background elements when dialog is shown/hidden
     */
    private fun setBackgroundFocusable(focusable: Boolean) {
        // Disable/enable profilesContainer children
        for (i in 0 until profilesContainer.childCount) {
            profilesContainer.getChildAt(i)?.apply {
                isFocusable = focusable
                isClickable = focusable
            }
        }
        // Disable/enable edit button
        editProfilesButton.isFocusable = focusable
        editProfilesButton.isClickable = focusable
    }
    
    private fun saveProfile() {
        val name = profileNameInput.text.toString().trim()
        
        if (name.isEmpty()) {
            Toast.makeText(this, "Veuillez entrer un nom", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (name.length > 20) {
            Toast.makeText(this, "Le nom est trop long (max 20 caractères)", Toast.LENGTH_SHORT).show()
            return
        }
        
        val isKids = kidsProfileCheckbox.isChecked
        
        // Handle PIN
        val pinEnabled = pinEnabledCheckbox.isChecked
        val pin: String? = if (pinEnabled) {
            val enteredPin = pinCodeInput.text.toString()
            if (enteredPin.length != 4) {
                Toast.makeText(this, "Le code PIN doit être de 4 chiffres", Toast.LENGTH_SHORT).show()
                return
            }
            enteredPin
        } else {
            null
        }
        
        if (editingProfile != null) {
            // Update existing profile
            val updated = editingProfile!!.copy(
                name = name,
                avatarIndex = selectedAvatarIndex,
                isKidsProfile = isKids,
                pin = pin
            )
            ProfileManager.updateProfile(updated)
            Toast.makeText(this, "Profil mis à jour", Toast.LENGTH_SHORT).show()
        } else {
            // Create new profile
            val newProfile = ProfileManager.createProfile(name, selectedAvatarIndex, isKids, pin)
            if (newProfile != null) {
                Toast.makeText(this, "Profil créé", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Impossible de créer plus de profils", Toast.LENGTH_SHORT).show()
                return
            }
        }
        
        hideCreateProfileDialog()
        loadProfiles()
    }
    
    private fun toggleEditMode() {
        isEditMode = !isEditMode
        editProfilesButton.text = if (isEditMode) "Terminé" else "Gérer les profils"
        loadProfiles()
    }
    
    fun showDeleteConfirmation(profile: Profile) {
        AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
            .setTitle("Supprimer le profil")
            .setMessage("Voulez-vous vraiment supprimer le profil \"${profile.name}\" ?\n\nTout l'historique de visionnage sera perdu.")
            .setPositiveButton("Supprimer") { _, _ ->
                ProfileManager.deleteProfile(profile.id)
                Toast.makeText(this, "Profil supprimé", Toast.LENGTH_SHORT).show()
                loadProfiles()
            }
            .setNegativeButton("Annuler", null)
            .show()
    }
    
    override fun onBackPressed() {
        when {
            pinInputOverlay.visibility == View.VISIBLE -> {
                hidePinInputDialog()
            }
            createProfileOverlay.visibility == View.VISIBLE -> {
                hideCreateProfileDialog()
            }
            isEditMode -> {
                toggleEditMode()
            }
            else -> {
                // Don't allow going back without selecting a profile
                if (ProfileManager.getProfiles().isEmpty()) {
                    Toast.makeText(this, "Veuillez créer un profil", Toast.LENGTH_SHORT).show()
                } else {
                    super.onBackPressed()
                }
            }
        }
    }
    
    /**
     * Handle remote control number keys for PIN input
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Only handle number keys when PIN dialog is visible
        if (pinInputOverlay.visibility == View.VISIBLE) {
            val digit = when (keyCode) {
                KeyEvent.KEYCODE_0, KeyEvent.KEYCODE_NUMPAD_0 -> "0"
                KeyEvent.KEYCODE_1, KeyEvent.KEYCODE_NUMPAD_1 -> "1"
                KeyEvent.KEYCODE_2, KeyEvent.KEYCODE_NUMPAD_2 -> "2"
                KeyEvent.KEYCODE_3, KeyEvent.KEYCODE_NUMPAD_3 -> "3"
                KeyEvent.KEYCODE_4, KeyEvent.KEYCODE_NUMPAD_4 -> "4"
                KeyEvent.KEYCODE_5, KeyEvent.KEYCODE_NUMPAD_5 -> "5"
                KeyEvent.KEYCODE_6, KeyEvent.KEYCODE_NUMPAD_6 -> "6"
                KeyEvent.KEYCODE_7, KeyEvent.KEYCODE_NUMPAD_7 -> "7"
                KeyEvent.KEYCODE_8, KeyEvent.KEYCODE_NUMPAD_8 -> "8"
                KeyEvent.KEYCODE_9, KeyEvent.KEYCODE_NUMPAD_9 -> "9"
                KeyEvent.KEYCODE_DEL, KeyEvent.KEYCODE_FORWARD_DEL -> {
                    // Handle delete key
                    if (enteredPin.isNotEmpty()) {
                        enteredPin.deleteCharAt(enteredPin.length - 1)
                        updatePinDots()
                    }
                    return true
                }
                else -> null
            }
            
            if (digit != null) {
                if (enteredPin.length < 4) {
                    enteredPin.append(digit)
                    updatePinDots()
                    pinErrorText.visibility = View.GONE
                    
                    // Auto-validate when 4 digits entered
                    if (enteredPin.length == 4) {
                        validatePin()
                    }
                }
                return true
            }
        }
        
        return super.onKeyDown(keyCode, event)
    }
}

