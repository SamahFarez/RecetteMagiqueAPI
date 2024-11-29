// api/fetch-recipes.js
const axios = require('axios');

const SPOONACULAR_API_KEY = 'e1b5c0675f514fcb86cbecbeb5fbee3f'; // Your API key

// List of common meat ingredients to check against
const meatKeywords = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'seafood'];

// Function to filter out non-vegetarian ingredients
const filterNonVegetarianIngredients = (ingredients) => {
    return ingredients.filter(ingredient => !meatKeywords.includes(ingredient.toLowerCase()));
};

// Function to clean recipe names
const cleanRecipeName = (title) => {
    return title.replace(/^How to Make\s+/i, ''); // Remove 'How to' at the beginning of the title
};

module.exports = async (req, res) => {
    const { ingredients, diet } = req.query; // Get ingredients and diet from query parameters
    
    if (!ingredients) {
        return res.status(400).json({ error: 'Please provide valid ingredients.' });
    }

    let ingredientList = ingredients.split(','); // Split into an array

    if (diet && diet.toLowerCase() === 'vegetarian') {
        ingredientList = filterNonVegetarianIngredients(ingredientList);
    }

    if (ingredientList.length === 0) {
        return res.status(400).json({ error: 'No valid vegetarian ingredients were provided.' });
    }

    const ingredientsString = ingredientList.join(',');

    try {
        const response = await axios.get(
            `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${ingredientsString}&apiKey=${SPOONACULAR_API_KEY}${diet ? `&diet=${diet}` : ''}`
        );

        if (response.data.length === 0) {
            return res.status(404).send('No recipes found.');
        }

        // Prepare output for the browser
        const detailedRecipes = await Promise.all(response.data.map(async recipe => {
            const recipeDetailResponse = await axios.get(`https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${SPOONACULAR_API_KEY}`);
            let { title, readyInMinutes, instructions, extendedIngredients } = recipeDetailResponse.data;
            
            title = cleanRecipeName(title);
            const usedIngredients = extendedIngredients.map(ing => ing.name).join(', ');

            return `Recipe Name: ${title}\nCooking Time: ${readyInMinutes} minutes\nIngredients: ${usedIngredients}\nInstructions: ${instructions}\n\n`;
        }));

        const filteredRecipes = detailedRecipes.filter(recipe => recipe !== null);

        if (filteredRecipes.length === 0) {
            return res.status(404).send('No suitable recipes found.');
        }

        const recipesOutput = filteredRecipes.join('\n\n');

        // Send the formatted output
        res.send(`<pre>${recipesOutput}</pre>`);

    } catch (error) {
        console.error('Error fetching recipes:', error.message);
        res.status(500).json({ error: 'Error fetching recipes from API.' });
    }
};
